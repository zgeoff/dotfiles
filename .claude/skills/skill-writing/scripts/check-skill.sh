#!/usr/bin/env bash
# Checks the structure of each skill; exits non-zero when a skill breaks a rule that fails the run.
# Usage (from the repo root): check-skill.sh [<skill-dir>...]
# With no argument it checks every directory holding a SKILL.md under .agents/skills/ and
# .claude/skills/, where a consumer repo installs skills, under skills/, where zgeoff/skills keeps
# them, and under sync/skills/, where zgeoff/tools keeps the shared skill bases. A skill whose
# SKILL.md git marks linguist-vendored is skipped, so a repo marks its third-party skills in
# .gitattributes.
# Fails on: a missing name or description, a name that differs from the folder or breaks the name
# format, a description over 1,024 characters, a plain description that holds a colon YAML reads as a
# key, frontmatter that Bun.YAML.parse refuses (at the line it fails on), a link with a line anchor outside code, and a SKILL.md body over 1,700 words.
# Warns on: a SKILL.md body over 1,500 words, a SKILL.md over 500
# lines, a reference that SKILL.md does not list under ## References, a reference over 100 lines
# with two or more headings and no contents list near its top, a code-formatted span outside a table that names an existing repo file, and a bullet in
# a rule set's SKILL.md that opens with an article or "Each" and a noun, a code span and a verb, or a
# label and a colon.
set -uo pipefail

if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  echo "check-skill: run it inside a git work tree, because it lists the files with git" >&2
  exit 2
fi

# Lists tracked and untracked files, so a new skill is checked before it is staged.
# A caller runs it in a command substitution and exits on its failure, because git's failure
# otherwise reaches the check as an empty list.
list_files() {
  local listing
  if ! listing=$(git -c core.quotePath=false ls-files --cached --others --exclude-standard -- "$@"); then
    echo "check-skill: git ls-files failed, so no skill was checked" >&2
    exit 2
  fi
  sort -u <<< "$listing"
}

is_vendored() {
  local value
  value=$(git check-attr linguist-vendored -- "$1/SKILL.md" | sed 's/^.*: //')
  [ "$value" = set ] || [ "$value" = true ]
}

dirs=()

if [ "$#" -gt 0 ]; then
  for dir in "$@"; do
    dir=${dir%/}
    if [ ! -f "$dir/SKILL.md" ]; then
      echo "check-skill: $dir has no SKILL.md" >&2
      exit 2
    fi
    dirs+=("$dir")
  done
else
  skill_files=$(list_files ':(glob).agents/skills/**/SKILL.md' ':(glob).claude/skills/**/SKILL.md' \
    ':(glob)skills/**/SKILL.md' ':(glob)sync/skills/**/SKILL.md') || exit 2
  while IFS= read -r file; do
    [ -n "$file" ] && [ -f "$file" ] && dirs+=("$(dirname "$file")")
  done <<< "$skill_files"
fi

checked=()

for dir in "${dirs[@]}"; do
  is_vendored "$dir" || checked+=("$dir")
done

if [ "${#checked[@]}" -eq 0 ]; then
  echo 'check-skill: no skills to check'
  exit 0
fi

perl -COE -e '
use strict;
use warnings;

my ($errors, $warnings) = (0, 0);

for my $dir (@ARGV) {
  $dir =~ s{^\./}{};
  check_skill($dir);
}

printf "check-skill: %d skills, %d errors, %d warnings\n", scalar @ARGV, $errors, $warnings;
exit($errors ? 1 : 0);

sub fail {
  my ($where, $message) = @_;
  print "$where: $message\n";
  $errors++;
}

sub warn_about {
  my ($where, $message) = @_;
  print "$where: $message (warning)\n";
  $warnings++;
}

sub to_bytes {
  my ($text) = @_;
  utf8::encode($text);
  return $text;
}

sub read_lines {
  my ($path) = @_;
  local $/ = "\n";
  open my $fh, "<:encoding(UTF-8)", to_bytes($path) or die "check-skill: cannot read $path: $!\n";
  my @lines = <$fh>;
  close $fh;
  chomp @lines;
  return @lines;
}

sub check_skill {
  my ($dir) = @_;
  my $skill = "$dir/SKILL.md";
  my @lines = read_lines($skill);

  warn_about($skill, scalar(@lines) . " lines, over 500; check that each section is one most tasks need")
    if @lines > 500;
  check_words($skill, @lines);
  check_bullets($skill, @lines) if is_rule_set(@lines);
  check_frontmatter($dir, $skill, @lines);

  open my $list, "-|", "git", "-c", "core.quotePath=false", "ls-files", "--cached", "--others",
    "--exclude-standard", "--", $dir, ":(exclude,attr:linguist-vendored)",
    ":(exclude,attr:linguist-vendored=true)" or die "check-skill: cannot list $dir: $!\n";
  my %files;
  while (my $file = <$list>) {
    chomp $file;
    utf8::decode($file);
    $files{$file} = 1 if $file =~ /\.md\z/ && -f to_bytes($file);
  }
  close $list;

  for my $file (sort keys %files) {
    check_markdown($dir, $file, $file eq $skill);
  }

  my %listed = map { $_ => 1 } list_references($skill, @lines);
  for my $file (sort grep { m{^\Q$dir\E/references/[^/]+\.md\z} } keys %files) {
    warn_about($file, "SKILL.md does not list it under ## References; add a line naming the task that needs it")
      unless $listed{$file};
  }
}

# Counts the words of the body after the frontmatter, code blocks included. After a compaction,
# Claude Code brings back only the first 5,000 tokens of each loaded skill, about 1,900 words of a
# skill, so past the error limit the end of the skill is lost; past the warning limit an agent starts
# to skim. A rule set gets the same limits, because the agent needs every rule in it.
sub check_words {
  my ($skill, @lines) = @_;
  my ($warn, $limit) = (1500, 1700);
  my $start = 0;
  if (@lines && $lines[0] eq "---") {
    for my $i (1 .. $#lines) {
      if ($lines[$i] eq "---") { $start = $i + 1; last }
    }
  }
  my $words = 0;
  for my $line (@lines[$start .. $#lines]) {
    $words += () = $line =~ /\S+/g;
  }
  if ($words > $limit) {
    fail($skill, "body is $words words, over the limit of $limit; cut it, or move what only some tasks need into a reference");
  } elsif ($words > $warn) {
    warn_about($skill, "body is $words words, over $warn; cut it, or move what only some tasks need into a reference");
  }
}

# Returns true when the frontmatter sets kind: rule-set under metadata, in a block or a flow mapping.
sub is_rule_set {
  my (@lines) = @_;
  return 0 unless @lines && $lines[0] eq "---";
  my ($in_metadata, $indent) = (0, undef);
  for my $i (1 .. $#lines) {
    my $line = $lines[$i];
    return 0 if $line eq "---";
    if ($line =~ /^metadata:(?:\s+#.*)?\s*$/) { ($in_metadata, $indent) = (1, undef); next }
    if ($line =~ /^metadata:\s*\{(.*)\}\s*(?:#.*)?$/) {
      for my $entry (split_flow_entries($1)) {
        return 1 if $entry =~ /^\s*kind:\s*(.*?)\s*$/ && unquote($1) eq "rule-set";
      }
      $in_metadata = 0;
      next;
    }
    # A comment-only line, at any indent, is neither a key nor the end of the mapping.
    next if $line =~ /^\s*#/;
    $in_metadata = 0 if $line =~ /^\S/;
    next unless $in_metadata && $line =~ /^(\s+)(\S.*?)\s*$/;
    # Only a key of metadata itself counts, never a deeper line, such as the text of a block value.
    $indent //= length $1;
    return 1 if length($1) == $indent && $2 =~ /^kind:\s*(.*)$/ && unquote($1) eq "rule-set";
  }
  return 0;
}

# A rule set is a list of bullets the agent applies while it does other work, so each bullet opens
# with what the agent does, a ban or a condition. A bullet that opens with a thing as its subject,
# or with a label and a colon, leaves the agent to work out the action.
sub check_bullets {
  my ($skill, @lines) = @_;
  my ($open, $line_number, $in_frontmatter) = ("", 0, @lines && $lines[0] eq "---");
  for my $line (@lines) {
    $line_number++;
    if ($in_frontmatter) {
      $in_frontmatter = 0 if $line_number > 1 && $line eq "---";
      next;
    }
    # A fence may open inside a list item, after its marker, but closes only on a line of its own.
    # The info string of a backtick fence never holds a backtick, so a line such as
    # "```name``` runs" is an inline code span, not a fence.
    my $marker_pattern = $open eq "" ? qr/^\s*(?:[-*+]\s+|\d+[.)]\s+)?(`{3,}|~{3,})(.*)$/
      : qr/^\s*(`{3,}|~{3,})(.*)$/;
    if ($line =~ $marker_pattern && !($open eq "" && substr($1, 0, 1) eq "`" && $2 =~ /`/)) {
      my ($marker, $rest) = ($1, $2);
      if ($open eq "") { $open = $marker }
      elsif (substr($marker, 0, 1) eq substr($open, 0, 1) && length($marker) >= length($open)
        && $rest =~ /^\s*$/) { $open = "" }
      next;
    }
    next if $open ne "";
    next unless $line =~ /^\s*[-*+]\s+(.*)$/;
    my $text = $1 =~ s/^\*\*//r;
    my $problem;
    if ($text =~ /^(A|An|The|Each|Every)\s+[\w`]/) {
      $problem = "opens with \"$1\" and a noun";
    } elsif (($text =~ /^`[^`]+`\s+([a-z]+)\b/ ? $1 : "") =~ /^(?!(?:as|this|its)\z)(?:are|have|can|may|must|do|[a-z]+s)\z/) {
      $problem = "opens with a code span and a verb";
    } elsif ($text =~ /^([A-Z][\w-]*(?:\s[\w-]+){0,2}):(?:\*\*)?\s/ && $1 !~ /^(?:When|If|In|Never|No)\b/) {
      $problem = "opens with the label \"$1:\"";
    }
    warn_about("$skill:$line_number", "bullet $problem; open it with what the agent does, a ban such as \"Never\", or a condition such as \"When\"")
      if $problem;
  }
}

# Splits the inside of a YAML flow mapping at each comma that sits outside a quoted value and a
# nested flow collection, so a comma inside a value never starts an entry.
sub split_flow_entries {
  my ($text) = @_;
  my (@entries, $quote);
  my ($entry, $depth) = ("", 0);
  for (my $i = 0; $i < length $text; $i++) {
    my $char = substr($text, $i, 1);
    if (defined $quote) {
      if ($quote eq "\"" && $char eq "\\") { $entry .= substr($text, $i, 2); $i++; next }
      undef $quote if $char eq $quote;
    } elsif ($char eq "\"" || $char eq "\x27") {
      $quote = $char;
    } elsif ($char eq "{" || $char eq "[") {
      $depth++;
    } elsif ($char eq "}" || $char eq "]") {
      $depth--;
    } elsif ($char eq "," && $depth == 0) {
      push @entries, $entry;
      $entry = "";
      next;
    }
    $entry .= $char;
  }
  return (@entries, $entry);
}

# Returns the files that the links under the ## References heading of SKILL.md point at.
sub list_references {
  my ($skill, @lines) = @_;
  my ($in_section, @found) = (0);
  for my $line (@lines) {
    if ($line =~ /^##\s+(.*?)\s*$/) {
      $in_section = $1 eq "References";
      next;
    }
    next unless $in_section;
    while ($line =~ /\]\(\s*([^()\s#]+)/g) {
      my $resolved = resolve_path($skill, $1);
      push @found, $resolved if defined $resolved;
    }
  }
  return @found;
}

# Reads the frontmatter block: a name, and a description that may fold over indented lines.
sub check_frontmatter {
  my ($dir, $skill, @lines) = @_;
  my ($name, $description, $in_description, $closed, $raw_description, $folded, $style, $colon);
  my @block;

  if (@lines && $lines[0] eq "---") {
    for my $line (@lines[1 .. $#lines]) {
      if ($line eq "---") { $closed = 1; last }
      push @block, $line;
      if ($line =~ /^name:\s*(.*?)\s*$/) {
        $name = unquote($1);
        $in_description = 0;
      } elsif ($line =~ /^description:\s*(.*?)\s*$/) {
        $raw_description = $1;
        $style = pick_scalar_style($raw_description);
        $description = ($style // "") eq "block" ? "" : unquote($raw_description);
        $colon = 1 if ($style // "") eq "plain" && has_key_colon($description);
        $in_description = 1;
      } elsif ($in_description && $line =~ /^\s+(\S.*?)\s*$/) {
        $description .= ($description eq "" ? "" : " ") . $1;
        $style //= $1 =~ /\A["\x27]/ ? "quoted" : "plain";
        $colon = 1 if $style eq "plain" && has_key_colon($1);
        $folded = 1;
      } elsif ($line =~ /^[A-Za-z_-]+:/) {
        $in_description = 0;
      }
    }
  }

  # A plain null (null, Null, NULL or ~) on one line has no text, as YAML reads it.
  $description = "" if !$folded && defined $raw_description
    && $raw_description =~ /\A(?:null|Null|NULL|~)(?:\s+#.*)?\z/;

  unless ($closed) {
    fail($skill, "has no frontmatter block");
    return;
  }

  if (!defined $name || $name eq "") {
    fail($skill, "has no name");
  } else {
    my $folder = $dir =~ s{.*/}{}r;
    fail($skill, "name $name does not match the folder $folder") if $name ne $folder;
    fail($skill, "name $name is not lowercase letters, digits and hyphens of at most 64 characters")
      if $name !~ /\A[a-z0-9-]{1,64}\z/;
  }

  if (!defined $description || $description eq "") {
    fail($skill, "has no description");
  } elsif (length $description > 1024) {
    fail($skill, "description is " . length($description) . " characters, over the limit of 1024");
  }

  fail($skill, "description holds a colon and a space, which YAML reads as a key in a plain scalar; reword it, or quote it or write it as a block scalar (>-)")
    if $colon;

  # The colon error already names the cause of the parse error that the colon brings.
  my ($yaml_line, $yaml_error) = $colon ? () : read_yaml_error(join("\n", @block));
  # The block starts on the line after the opening ---.
  my $where = defined $yaml_line ? "$skill:" . ($yaml_line + 1) : $skill;
  fail($where, "frontmatter is not valid YAML ($yaml_error), so a strict loader refuses the skill; escape each quote inside a quoted value, or write the value as a block scalar (>-)")
    if defined $yaml_error;
}

# Returns the line that Bun.YAML.parse fails on and its error, or an empty list when it parses.
# The error of Bun holds no line. A head cut inside a valid quoted value fails with another error,
# so the line is the first one from which each head fails with the error that the whole text gives.
sub read_yaml_error {
  my ($text) = @_;
  my $parse = q{
    const lines = process.argv.at(-1).split("\n");
    const readError = (count) => {
      try { Bun.YAML.parse(lines.slice(0, count).join("\n")); return null } catch (error) { return error.message }
    };
    const message = readError(lines.length);
    if (message === null) process.exit(0);
    let line = lines.length;
    while (line > 1 && readError(line - 1) === message) line--;
    console.log(`${line}\t${message}`);
    process.exit(1);
  };
  my $parser;
  # The check prints its own message when bun is missing, in place of the warning perl adds.
  no warnings "exec";
  unless (open $parser, "-|", "bun", "-e", $parse, to_bytes($text)) {
    print STDERR "check-skill: cannot run bun to parse the frontmatter: $!\n";
    exit 2;
  }
  my $output = do { local $/; <$parser> } // "";
  close $parser;
  return () if $? == 0;
  utf8::decode($output);
  $output =~ s/\s+\z//;
  $output =~ s/\s*\n\s*/ /g;
  return ($1, $2) if $output =~ /\A([0-9]+)\t(.+)\z/;
  return (undef, $output eq "" ? "bun exited with status " . ($? >> 8) : $output);
}

# Returns block, quoted or plain for the text after a key, or undef when the text is empty or only a
# comment, since the scalar then starts on the next line. A block header may hold an indentation
# digit and a chomping sign in either order, then a comment.
sub pick_scalar_style {
  my ($text) = @_;
  return undef if $text eq "" || $text =~ /\A#/;
  return "block" if $text =~ /\A[|>](?:[1-9][+-]?|[+-][1-9]?)?(?:\s+#.*)?\z/;
  return "quoted" if $text =~ /\A["\x27]/;
  return "plain";
}

# A colon followed by a space or the line end starts a mapping inside a plain YAML scalar, so a
# loader rejects the frontmatter. A space and a hash end the scalar and start a comment.
sub has_key_colon {
  my ($text) = @_;
  return ($text =~ s/\s+#.*\z//r) =~ /:(?:\s|\z)/;
}

# Returns the value of a scalar: the text inside its quotes, or plain text without a trailing comment.
sub unquote {
  my ($text) = @_;
  return $2 if $text =~ /\A(["\x27])(.*?)\1\s*(?:#.*)?\z/;
  return "" if $text =~ /\A#/;
  $text =~ s/\s+#.*\z//;
  return $text;
}

sub check_markdown {
  my ($dir, $file, $is_skill) = @_;
  my @lines = read_lines($file);
  my $open = "";
  my $line_number = 0;
  my $contents_links = 0;
  my $headings = 0;
  my $reference = !$is_skill;
  my $in_comment = 0;

  for my $line (@lines) {
    $line_number++;
    if ($line =~ /^\s*(`{3,}|~{3,})(.*)$/) {
      my ($marker, $rest) = ($1, $2);
      if ($open eq "") { $open = $marker }
      elsif (substr($marker, 0, 1) eq substr($open, 0, 1) && length($marker) >= length($open)
        && $rest =~ /^\s*$/) { $open = "" }
      next;
    }
    next if $open ne "";
    $headings++ if $line =~ /^#{2,6}\s/;

    # An HTML comment never renders, so its text holds no link and no path.
    # A comment marker inside inline code renders as text, so the spans hide their markers first.
    my $visible = $line =~ s{(`+)(.+?)\1}{my $span = $&; $span =~ s/<!--/<\x{1}!--/g; $span =~ s/-->/--\x{1}>/g; $span}ger;
    if ($in_comment) {
      next unless $visible =~ s/\A.*?-->//;
      $in_comment = 0;
    }
    $visible =~ s/<!--.*?-->//g;
    $in_comment = 1 if $visible =~ s/<!--.*\z//;
    $visible =~ s/\x{1}//g;

    my $text = $visible;
    my @spans;
    $text =~ s/(`+)(.+?)\1/push @spans, $2; ""/ge;

    if ($line_number <= 30) {
      $contents_links++ while $text =~ /\]\(#[^)\s]+\)/g;
    }

    my @targets;
    push @targets, $1 while $text =~ /\]\(\s*(<[^>]*>|(?:[^()\s]|\([^()\s]*\))+)/g;
    push @targets, $1 if $text =~ /^\s{0,3}\[(?!\^)[^\]]+\]:\s*(<[^>]*>|\S+)/;
    push @targets, $2 while $text =~ /\b(?:href|src)\s*=\s*(["\x27])(.*?)\1/g;

    for my $target (@targets) {
      $target =~ s/^<(.*)>$/$1/;
      fail("$file:$line_number", "link $target has a line anchor; name the target in the link text instead")
        if $target =~ /#L[0-9]+/;
    }

    # A span inside link text is already a link, so only the spans left after links drop are read.
    # A table row holds commands the agent types, such as the commands table of a skill, so it is skipped.
    next if $visible =~ /^\s*\|/;
    my $outside_links = $visible =~ s/!?\[[^\]]*\]\([^)]*\)//gr;
    my @bare;
    $outside_links =~ s/(`+)(.+?)\1/push @bare, $2; ""/ge;

    for my $span (@bare) {
      $span =~ s/^\s+|\s+$//g;
      next if $span !~ m{\A[\w.@/-]+\z} || $span !~ m{/};
      warn_about("$file:$line_number", "`$span` names a file in the repo; link it instead")
        if -f to_bytes($span);
    }
  }

  if ($reference && @lines > 100 && $headings >= 2 && $contents_links < 2) {
    warn_about($file, scalar(@lines) . " lines with no contents list near the top; open with links to its headings");
  }
}

sub resolve_path {
  my ($file, $path) = @_;
  return undef if $path eq "";
  my @parts = $path =~ m{^/} ? () : split m{/}, $file;
  pop @parts unless $path =~ m{^/};
  for my $part (split m{/}, $path) {
    next if $part eq "" || $part eq ".";
    if ($part eq "..") {
      return undef unless @parts;
      pop @parts;
    } else {
      push @parts, $part;
    }
  }
  return @parts ? join("/", @parts) : undef;
}
' -- "${checked[@]}"
