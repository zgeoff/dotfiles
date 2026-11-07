#!/usr/bin/env bash
# Checks every relative link and anchor in Markdown files; exits non-zero on a broken one.
# Usage (from the repo root): check-links.sh [<path>...]
# With no path, it reads every README.md outside .claude/ and .agents/, every spike's results.md,
# every Markdown file under docs/, and every skill's Markdown under .agents/skills/ and
# .claude/skills/, where a consumer repo installs skills, under skills/, where zgeoff/skills keeps
# them, and under sync/skills/, where zgeoff/tools keeps the shared skill bases. A link with a
# scheme (https:, mailto:) is never followed. An anchor is checked only on a Markdown target, against
# GitHub's heading anchors and the page's explicit id and name attributes.
set -uo pipefail

if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  echo "check-links: run it inside a git work tree, because it lists the files with git" >&2
  exit 2
fi

if [ "$#" -eq 0 ]; then
  set -- ':(glob)**/README.md' ':(glob)**/results.md' ':(glob)docs/**/*.md' \
    ':(glob).agents/skills/**/*.md' ':(glob).claude/skills/**/*.md' ':(glob)skills/**/*.md' \
    ':(glob)sync/skills/**/*.md' \
    ':(exclude,glob).claude/**/README.md' ':(exclude,glob).agents/**/README.md'
fi

# The repo's project-docs-writing skill links to placeholder targets as examples, and so do the
# shared docs-writing and skill-writing skills, which a repo installs under .agents/skills/ or
# .claude/skills/. A file git marks linguist-vendored belongs to someone else.
set -- "$@" ':(exclude).agents/skills/project-docs-writing' \
  ':(exclude).claude/skills/project-docs-writing' ':(exclude).agents/skills/docs-writing' \
  ':(exclude).agents/skills/skill-writing' ':(exclude).claude/skills/docs-writing' \
  ':(exclude).claude/skills/skill-writing' ':(exclude)sync/skills/docs-writing' \
  ':(exclude)sync/skills/skill-writing' ':(exclude,attr:linguist-vendored)' \
  ':(exclude,attr:linguist-vendored=true)'

# The pipeline below drops git's exit status until perl has printed its summary, so a git that
# cannot list the files fails here first.
if ! git ls-files --cached --others --exclude-standard -- "$@" > /dev/null; then
  echo "check-links: git ls-files failed, so no link was checked" >&2
  exit 2
fi

# Reads untracked files too, so a new doc is checked before it is staged.
git ls-files -z --cached --others --exclude-standard -- "$@" | perl -0 -COE -e '
use strict;
use warnings;

my (%seen, @files);
while (my $file = <STDIN>) {
  chomp $file;
  utf8::decode($file);
  next if $file !~ /\.md\z/ || $seen{$file}++ || !-f to_bytes($file);
  push @files, $file;
}

my (%anchor_cache, $broken);

for my $file (sort @files) {
  my $line_number = 0;
  my $open = "";
  my $in_comment = 0;
  for my $line (read_lines($file)) {
    $line_number++;
    if ($open eq "") {
      ($line, $in_comment) = strip_comments($line, $in_comment);
    }
    if ($line =~ /^\s*(`{3,}|~{3,})(.*)$/) {
      my ($marker, $rest) = ($1, $2);
      if ($open eq "") { $open = $marker }
      elsif (substr($marker, 0, 1) eq substr($open, 0, 1) && length($marker) >= length($open)
        && $rest =~ /^\s*$/) { $open = "" }
      next;
    }
    next if $open ne "";
    for my $target (collect_targets($line)) {
      my $problem = check_target($file, $target);
      next unless defined $problem;
      print STDERR "$file:$line_number: ($target) $problem\n";
      $broken++;
    }
  }
}

if ($broken) {
  exit 1;
}
printf "check-links: %d files, every relative link resolves\n", scalar @files;

# File names stay decoded text until they reach the filesystem.
sub to_bytes {
  my ($text) = @_;
  utf8::encode($text);
  return $text;
}

# GitHub never renders an HTML comment, so a link inside one is dropped. Returns the line without
# its comments and whether a comment is still open at its end.
sub strip_comments {
  my ($line, $in_comment) = @_;
  my $kept = "";
  while (length $line) {
    if ($in_comment) {
      my $end = index $line, "-->";
      return ($kept, 1) if $end < 0;
      $line = substr $line, $end + 3;
      $in_comment = 0;
    } else {
      my $start = index $line, "<!--";
      return ($kept . $line, 0) if $start < 0;
      $kept .= substr $line, 0, $start;
      $line = substr $line, $start + 4;
      $in_comment = 1;
    }
  }
  return ($kept, $in_comment);
}

sub read_lines {
  my ($path) = @_;
  local $/ = "\n";
  open my $fh, "<:encoding(UTF-8)", to_bytes($path) or die "check-links: cannot read $path: $!\n";
  my @lines = <$fh>;
  close $fh;
  chomp @lines;
  return @lines;
}

# Inline links and images, reference definitions, and HTML href and src attributes. Code spans
# are dropped first, since a link inside one is literal text. A target may hold one level of
# balanced parentheses, and a footnote definition is no link.
sub collect_targets {
  my ($line) = @_;
  $line =~ s/(`+).*?\1//g;
  my @targets;
  push @targets, $1 while $line =~ /\]\(\s*(<[^>]*>|(?:[^()\s]|\([^()\s]*\))+)/g;
  push @targets, $1 if $line =~ /^\s{0,3}\[(?!\^)[^\]]+\]:\s*(<[^>]*>|\S+)/;
  push @targets, $1 while $line =~ /\b(?:href|src)\s*=\s*"([^"]*)"/g;
  return map { s/^<(.*)>$/$1/r } @targets;
}

sub check_target {
  my ($file, $target) = @_;
  return undef if $target eq "" || $target =~ m{^(?:[a-z][a-z0-9+.-]*:|//)}i;
  my ($path, $anchor) = split /#/, $target, 2;
  $path =~ s/\?.*//;
  $path = decode_percent($path);
  my $resolved = $path eq "" ? $file : resolve_path($file, $path);
  return "points outside the repository" unless defined $resolved;
  return "$resolved does not exist" unless -e to_bytes($resolved);
  return undef if !defined $anchor || $anchor eq "" || -d to_bytes($resolved) || $resolved !~ /\.md\z/;
  $anchor = decode_percent($anchor);
  my $anchors = $anchor_cache{$resolved} //= collect_anchors($resolved);
  return $anchors->{$anchor} ? undef : "$resolved has no heading #$anchor";
}

sub decode_percent {
  my ($text) = @_;
  utf8::encode($text);
  $text =~ s/%([0-9A-Fa-f]{2})/chr hex $1/ge;
  utf8::decode($text);
  return $text;
}

# A leading slash resolves from the repository root, as GitHub resolves it.
sub resolve_path {
  my ($file, $path) = @_;
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
  return @parts ? join("/", @parts) : ".";
}

# GitHub anchors: ATX and setext headings outside code blocks, slugged and numbered on repeat,
# plus explicit id and name attributes.
sub collect_anchors {
  my ($path) = @_;
  my (%anchors, %count);
  my $open = "";
  my $previous = "";
  my @lines = read_lines($path);
  my $start = 0;
  if (@lines && $lines[0] eq "---") {
    for my $i (1 .. $#lines) {
      if ($lines[$i] eq "---") { $start = $i + 1; last }
    }
  }
  for my $line (@lines[$start .. $#lines]) {
    if ($line =~ /^\s*(`{3,}|~{3,})(.*)$/) {
      my ($marker, $rest) = ($1, $2);
      if ($open eq "") { $open = $marker }
      elsif (substr($marker, 0, 1) eq substr($open, 0, 1) && length($marker) >= length($open)
        && $rest =~ /^\s*$/) { $open = "" }
      $previous = "";
      next;
    }
    next if $open ne "";
    my $title;
    if ($line =~ /^ {0,3}#{1,6}(?:\s+(.*?))?\s*$/) {
      $title = ($1 // "") =~ s/\s+#+\s*$//r;
    } elsif ($line =~ /^ {0,3}(?:=+|-+)\s*$/ && $previous =~ /\S/
      && $previous !~ /^\s*(?:[-*+]\s|\d+[.)]\s|>|#|\|)/) {
      $title = $previous =~ s/^\s+|\s+$//gr;
    }
    if (defined $title) {
      my $slug = build_slug($title);
      my $n = $count{$slug}++;
      $anchors{$n ? "$slug-$n" : $slug} = 1;
    }
    $anchors{$1} = 1 while $line =~ /\b(?:id|name)\s*=\s*"([^"]+)"/g;
    $previous = $line;
  }
  return \%anchors;
}

# GitHub slugs the rendered heading text. Outside code spans, link syntax, HTML tags and emphasis
# markers drop and entities decode; a code span keeps its text. Then the text is lowercased,
# every character but a letter, mark, digit, "_", "-" or space dropped, and each space a "-".
sub build_slug {
  my ($title) = @_;
  my @parts = split /(`+[^`]*`+)/, $title;
  for my $part (@parts) {
    if ($part =~ /^`+([^`]*)`+$/) {
      $part = $1;
      next;
    }
    $part =~ s/!?\[([^\]]*)\]\([^)]*\)/$1/g;
    $part =~ s/<[^>]+>//g;
    $part =~ s/(?<![\p{L}\p{N}])[_*]+|[_*]+(?![\p{L}\p{N}])//g;
    $part =~ s/&#(\d+);/chr $1/ge;
    $part =~ s/&#x([0-9a-f]+);/chr hex $1/gie;
    my %entities = (amp => "&", lt => "<", gt => ">", quot => q("), nbsp => " ");
    $part =~ s/&(amp|lt|gt|quot|nbsp);/$entities{$1}/g;
  }
  $title = lc join "", @parts;
  $title =~ s/^\s+|\s+$//g;
  $title =~ s/[^\p{L}\p{M}\p{N}_\- ]//g;
  $title =~ s/ /-/g;
  return $title;
}
'
