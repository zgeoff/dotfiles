#!/usr/bin/env bash
# Greps committed docs for prose violations; exits non-zero when any are found.
# Violation greps fail the run; candidate greps print for judgment and never fail it.
# Usage (from the repo root): check-prose.sh [<path>...]
# With no path, it reads every README.md outside .claude/ and .agents/, every Markdown file under
# docs/, every spike's results.md, and every skill's Markdown under .agents/skills/ and
# .claude/skills/, where a consumer repo installs skills, under skills/, where zgeoff/skills keeps
# them, and under sync/skills/, where zgeoff/tools keeps the shared skill bases.
# The awk programs are single-quoted on purpose: awk, not the shell, expands their fields.
# shellcheck disable=SC2016
set -uo pipefail

if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  echo "check-prose: run it inside a git work tree, because it lists the files with git" >&2
  exit 2
fi

# A skill folder's README is a skill file, so only the READMEs outside the skill folders are listed
# one by one.
if [ "$#" -eq 0 ]; then
  if ! readme_list=$(git -c core.quotePath=false ls-files --cached --others --exclude-standard -- \
    ':(glob)**/README.md' ':(exclude,glob).claude/**' ':(exclude,glob).agents/**'); then
    echo "check-prose: git ls-files failed, so no doc was checked" >&2
    exit 2
  fi
  while IFS= read -r readme; do
    [ -n "$readme" ] && set -- "$@" "$readme"
  done < <(sort -u <<< "$readme_list")
  set -- "$@" ':(glob)docs/**/*.md' ':(glob)**/results.md' ':(glob).agents/skills/**/*.md' \
    ':(glob).claude/skills/**/*.md' ':(glob)skills/**/*.md' ':(glob)sync/skills/**/*.md'
fi

# The paragraph limits in words. repo-sync overwrites this file, so a repo cannot loosen them.
paragraph_warn=150
paragraph_fail=250

# The skill's own files, the repo's project skill beside them, and the skill-writing and deslop
# skills document the forbidden patterns and contain them as examples. A consumer repo installs skills under
# .agents/skills/ or .claude/skills/, and zgeoff/skills keeps them under skills/. A file git marks
# linguist-vendored belongs to someone else, so a repo marks its third-party skills in
# .gitattributes.
for root in .agents/skills .claude/skills skills sync/skills; do
  set -- "$@" ":(exclude)$root/docs-writing" ":(exclude)$root/project-docs-writing" \
    ":(exclude)$root/skill-writing" ":(exclude)$root/deslop"
done
set -- "$@" ':(exclude,attr:linguist-vendored)' ':(exclude,attr:linguist-vendored=true)'

# The greps below read git's file list in pipelines, which drop git's exit status, so a git that
# cannot list the files fails here once.
if ! git ls-files --cached --others --exclude-standard -- "$@" > /dev/null; then
  echo "check-prose: git ls-files failed, so no doc was checked" >&2
  exit 2
fi

# Every grep reads untracked files too, so a new doc is checked before it is staged, and skips
# binary files.
grep_docs() {
  git grep --untracked -I "$@"
}

# Prints the Markdown files the paths name, under the directory in $markdown_dir when it is set.
# Each path ends in a NUL, so it may hold any character, and starts with ./, so awk never reads a
# name that holds = as an assignment or one that starts with - as an option.
list_markdown() {
  local file
  while IFS= read -r -d '' file; do
    if [[ $file == *.md && $file == "${markdown_dir:-}"* && -f $file ]]; then
      printf './%s\0' "$file"
    fi
  done < <(git ls-files -z --cached --others --exclude-standard -- "$@")
}

# Tracks fenced code blocks (backtick or tilde, any indent, closed by the same marker at least as
# long) so the checks below can tell fence lines and fenced content from prose.
fence_awk='
function fence_marker(line, m) {
  if (match(line, /^[ \t]*(```+|~~~+)/)) {
    m = substr(line, RSTART, RLENGTH)
    sub(/^[ \t]*/, "", m)
    return m
  }
  return ""
}
function fence_rest(line, m) {
  return substr(line, index(line, m) + length(m))
}
function closes(m, rest) {
  return substr(m, 1, 1) == substr(open, 1, 1) && length(m) >= length(open) && rest ~ /^[ \t]*$/
}
# Returns the file name without the ./ that list_markdown puts before it.
function file_name() {
  return substr(FILENAME, 3)
}
FNR == 1 { open = "" }
'

fail=0

report() {
  local label=$1 out=$2
  if [ -n "$out" ]; then
    fail=1
    printf '%s\n%s\n\n' "$label" "$out"
  fi
}

candidate() {
  local label=$1 out=$2
  if [ -n "$out" ]; then
    printf '%s\n%s\n\n' "$label" "$out"
  fi
}

report 'Process residue (date stamps, investigation framing, memory citations, §):' \
  "$(grep_docs -nP 'Verified 20[0-9]{2}-|Investigation count|\(see memory |\([0-9]{2,4}-[0-9]{2}-[0-9]{2}\)|^Mitigation:|§' -- "$@")"

# The words every zgeoff repo bans; a repo's AGENTS.md lists them with their legal senses.
# Judgment-only bans (bites, floor, anchor) are not grepped. CAS stays case-sensitive so "CAs"
# passes.
# AGENTS.md and the agents/ partials hold the banned-words registry itself, and "code fence" and
# "fenced code" are the legal markdown sense of the word. In Markdown, code blocks and code spans
# are exempt, since an identifier in code may hold a banned word: awk blanks the spans and puts the
# rest before the line, split by a unit separator, and grep matches the pattern only before that
# separator.
banned_words='\bsurfaces?\b|load-bearing|\bseams?\b|\bceilings?\b|(?<!code )\bfenc(e|es|ed|ing)\b(?! code)|(?-i:\bCAS\b)|significantly|near-instant'
report 'Banned words:' \
  "$(
    grep_docs -nPi "$banned_words" -- "$@" ':(exclude)*.md' ':(exclude)AGENTS.md' ':(exclude)agents'
    list_markdown "$@" ':(exclude)AGENTS.md' ':(exclude)agents' | xargs -0 -r awk "$fence_awk"'
    # Replaces each code span with a space. As in CommonMark, a span closes at the next backtick run
    # as long as the one that opens it, and a run that nothing closes stays as text.
    function strip_spans(s, out, start, n, rest, r, off, closed) {
      out = ""
      while (match(s, /`+/)) {
        start = RSTART
        n = RLENGTH
        out = out substr(s, 1, start - 1)
        rest = substr(s, start + n)
        r = rest
        off = 0
        closed = 0
        while (match(r, /`+/)) {
          if (RLENGTH == n) {
            closed = 1
            off += RSTART
            break
          }
          off += RSTART + RLENGTH - 1
          r = substr(r, RSTART + RLENGTH)
        }
        if (closed) {
          out = out " "
          s = substr(rest, off + n)
        } else {
          out = out substr(s, start, n)
          s = rest
        }
      }
      return out s
    }
    {
      m = fence_marker($0)
      if (m != "") {
        rest = fence_rest($0, m)
        if (open == "") open = m
        else if (closes(m, rest)) open = ""
        next
      }
      if (open != "") next
      text = $0
      gsub(/\037/, "", text)
      text = strip_spans(text)
      print text "\037" file_name()":"FNR":"$0
    }' | grep -aPi "^[^\\x1f]*(?:$banned_words)" | cut -d $'\037' -f 2-
  )"

report 'Filler with no term-of-art use:' \
  "$(grep_docs -nPi 'organically|earns its complexity|cheap insurance|lays (the )?foundation|the right level' -- "$@")"

report 'Possessive on a markdown link:' \
  "$(grep_docs -nE "\]\([^)]*\)'s" -- "$@")"

report 'Role-label headings:' \
  "$(grep_docs -nE '^#{2,4} (Overview|Notes|Details|Rationale)$' -- "$@")"

report '"Should succeed" in a procedure — state the expected outcome instead:' \
  "$(grep_docs -nPi 'should (succeed|work|pass)\b' -- "$@")"

report 'Number joined to its unit ("64KB"; write "64 KB"; code blocks are exempt):' \
  "$(
    grep_docs -nP '\b[0-9]+(KB|MB|GB|TB|KiB|MiB|GiB|ms)\b' -- "$@" ':(exclude)*.md'
    list_markdown "$@" | xargs -0 -r awk "$fence_awk"'
    {
      m = fence_marker($0)
      if (m != "") {
        rest = fence_rest($0, m)
        if (open == "") open = m
        else if (closes(m, rest)) open = ""
        next
      }
      if (open == "" && $0 ~ /(^|[^[:alnum:]_])[0-9]+(KB|MB|GB|TB|KiB|MiB|GiB|ms)([^[:alnum:]_]|$)/) print file_name()":"FNR":"$0
    }'
  )"

# Architecture docs state rules, never values. Code spans are dropped first, since a command the
# reader types may hold a value. A bare s, d or h joined to its number is no unit here ("1990s",
# "2d"); its spaced form is.
report 'Values with units under docs/architecture (the code owns its values; code blocks are exempt):' \
  "$(markdown_dir=docs/architecture/ list_markdown "$@" | xargs -0 -r awk "$fence_awk"'
    {
      m = fence_marker($0)
      if (m != "") {
        rest = fence_rest($0, m)
        if (open == "") open = m
        else if (closes(m, rest)) open = ""
        next
      }
      if (open != "") next
      text = $0
      gsub(/`[^`]*`/, "", text)
      if (text ~ /(^|[^[:alnum:]_.])[0-9]+(\.[0-9]+)? ?(ms|min|KB|MB|GB|TB|KiB|MiB|GiB)([^[:alnum:]_]|$)/ ||
        text ~ /(^|[^[:alnum:]_.])[0-9]+(\.[0-9]+)? (s|h|d)([^[:alnum:]_]|$)/ ||
        text ~ /(^|[^[:alnum:]_.])[0-9]+[ -](second|minute|hour|day|week)s?([^[:alnum:]_]|$)/) print file_name()":"FNR":"$0
    }')"

report 'Horizontal rules outside YAML frontmatter:' \
  "$(list_markdown "$@" | xargs -0 -r awk \
    'FNR==1{fm=($0=="---")} fm&&FNR>1&&$0=="---"{fm=0;next} !fm&&$0=="---"{print substr(FILENAME, 3)": "FNR}')"

report 'Untagged code fences:' \
  "$(list_markdown "$@" | xargs -0 -r awk "$fence_awk"'
    {
      m = fence_marker($0)
      if (m == "") next
      rest = fence_rest($0, m)
      if (open == "") {
        open = m
        if (rest ~ /^[ \t]*$/) print file_name()": "FNR
      } else if (closes(m, rest)) {
        open = ""
      }
    }')"

# Lists the files the branch changes since its merge base with origin's default branch, then the
# uncommitted and untracked ones. The paragraph check reads only these, so a doc written before the
# check fails nobody until a branch edits it. Each path ends in a NUL, so a path may hold any
# character.
list_changed() {
  local default base
  default=$(git rev-parse -q --abbrev-ref origin/HEAD 2> /dev/null) || default=origin/main
  # Before the first commit, every staged file is new.
  if ! git rev-parse -q --verify HEAD > /dev/null; then
    git ls-files -z --cached
  else
    if base=$(git merge-base HEAD "$default" 2> /dev/null); then
      git diff -z --name-only --no-renames --diff-filter=d "$base" HEAD
    # A pull-request run in GitHub Actions checks out the PR's merge commit with no history and no
    # origin branches, so the base tip is fetched and the two trees compared.
    elif [ -n "${GITHUB_BASE_REF:-}" ] &&
      git fetch -q --no-tags --depth=1 origin "$GITHUB_BASE_REF" 2> /dev/null; then
      git diff -z --name-only --no-renames --diff-filter=d FETCH_HEAD HEAD
    else
      echo "check-prose: no merge base with $default, so the paragraph check reads only uncommitted files" >&2
    fi
    git diff -z --name-only --no-renames --diff-filter=d HEAD
  fi
  git ls-files -z --others --exclude-standard
}

# Prints file:line:words for each top-level prose paragraph over the warning limit. The parser runs
# the CommonMark block algorithm (with GFM tables) on each line: it matches the open block quotes
# and list items, tries block starts after the last one matched, and takes a lazy line only while a
# paragraph is the open block. Indentation is in columns, with tabs to the next multiple of 4.
#
# - A paragraph inside a list item or a block quote never counts; a paragraph outside them does.
# - A paragraph runs until a blank line or a line that interrupts it: an ATX heading, a fence, an
#   HTML block of types 1 to 6, a block quote, a thematic break, a bullet item with content, or an
#   ordered item numbered 1 with content.
# - Link reference definitions at the start of a paragraph are dropped before it is counted. A line
#   of = or - under a paragraph makes it a Setext heading, and a delimiter row with as many cells as
#   the paragraph's last line makes that line a table header; the lines above a header still count.
# - Indented code, fenced code, tables, HTML blocks (types 1 to 5 to their closing marker, types 6
#   and 7 to a blank line), frontmatter and headings never count.
paragraph_awk='
BEGIN {
  q = sprintf("%c", 39)
  esc = "\\\\."
  label = "^\\[[ \t\n]*([^][\\\\ \t\n]|" esc ")([^][\\\\]|" esc ")*\\]:"
  angle_destination = "^<([^<>\n\\\\]|" esc ")*>"
  title = "(\"([^\"\\\\]|" esc ")*\"|" q "([^" q "\\\\]|" esc ")*" q "|\\(([^()\\\\]|" esc ")*\\))"
  titled_end = "^([ \t]+|[ \t]*\n[ \t]*)" title "[ \t]*(\n|$)"
  value = "([^ \t\"" q "=<>`]+|" q "[^" q "]*" q "|\"[^\"]*\")"
  attribute = "[ \t]+[A-Za-z_:][A-Za-z0-9_.:-]*([ \t]*=[ \t]*" value ")?"
  open_tag = "^<[A-Za-z][A-Za-z0-9-]*(" attribute ")*[ \t]*/?>[ \t]*$"
  closing_tag = "^</[A-Za-z][A-Za-z0-9-]*[ \t]*>[ \t]*$"
}
# Expands each tab to the next column that is a multiple of 4.
function detab(line, out, i, c, col) {
  if (index(line, "\t") == 0) return line
  out = ""
  col = 0
  for (i = 1; i <= length(line); i++) {
    c = substr(line, i, 1)
    if (c == "\t") {
      out = out substr("    ", 1, 4 - col % 4)
      col += 4 - col % 4
    } else {
      out = out c
      col++
    }
  }
  return out
}
function spaces_at(line, p) {
  match(substr(line, p), /^ */)
  return RLENGTH
}
function is_atx(s) {
  return match(s, /^#+/) && RLENGTH <= 6 && substr(s, RLENGTH + 1) ~ /^([ \t]|$)/
}
function is_thematic(s) {
  return s ~ /^\*[ \t]*\*[ \t]*\*[ \t*]*$/ || s ~ /^-[ \t]*-[ \t]*-[ \t-]*$/ || s ~ /^_[ \t]*_[ \t]*_[ \t_]*$/
}
function is_setext_underline(s) {
  return s ~ /^(=+|-+)[ \t]*$/
}
# Returns the fence marker this line opens, or "" when it opens none. A backtick fence takes no
# backtick in its info string.
function fence_open(s, m) {
  m = fence_marker(s)
  if (m != "" && substr(m, 1, 1) == "`" && index(fence_rest(s, m), "`")) return ""
  return m
}
function fence_closes(opener, s, m) {
  m = fence_marker(s)
  return m != "" && substr(m, 1, 1) == substr(opener, 1, 1) && length(m) >= length(opener) &&
    fence_rest(s, m) ~ /^[ \t]*$/
}
# Counts the cells of a table row: its unescaped pipes, less an outer pipe at either end, plus one.
function cell_count(s, t) {
  t = s
  gsub(/\\\|/, "", t)
  sub(/^[ \t]*\|/, "", t)
  sub(/\|[ \t]*$/, "", t)
  return gsub(/\|/, "|", t) + 1
}
function is_table_delimiter(s) {
  return s ~ /\|/ && s ~ /^\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/
}
# Returns the pattern that closes the HTML block this line starts for types 1 to 5, "closed" when
# the same line closes it, "block" for type 6, or "" for any other line. A tag name needs a boundary
# after it, so <preview> starts no pre block.
function html_start(s, lower) {
  lower = tolower(s)
  if (match(lower, /^<(script|pre|style|textarea)([ \t>]|$)/)) return html_marker(lower, "</(script|pre|style|textarea)>")
  if (match(lower, /^<!--/)) return html_marker(lower, "-->")
  if (match(lower, /^<\?/)) return html_marker(lower, "[?]>")
  if (match(s, /^<!\[CDATA\[/)) return html_marker(s, "]]>")
  if (match(lower, /^<![a-z]/)) return html_marker(lower, ">")
  if (lower ~ /^<\/?(address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)([ \t>]|\/>|$)/) return "block"
  return ""
}
# The end condition holds when the line contains the marker anywhere, so <?> and <!--> close on
# their own line.
function html_marker(text, marker) {
  return text ~ marker ? "closed" : marker
}
# HTML block type 7: one complete open or closing tag, with valid attributes, alone on its line.
function is_lone_tag(s) {
  return (s ~ open_tag || s ~ closing_tag) && tolower(s) !~ /^<\/?(script|pre|style|textarea)[^a-z0-9-]/
}
# Returns the length of a bare link destination at the start of s, or 0 when there is none. As in
# the CommonMark reference parser, it ends at a space, a control character or an unmatched ), and
# an unclosed ( or a < at its start makes it invalid.
function bare_destination_length(s, i, c, depth) {
  if (substr(s, 1, 1) == "<") return 0
  depth = 0
  for (i = 1; i <= length(s); i++) {
    c = substr(s, i, 1)
    if (c == "\\" && substr(s, i + 1, 1) ~ /[!-\/:-@[-`{-~]/) i++
    else if (c ~ /[[:space:][:cntrl:]]/) break
    else if (c == "(") depth++
    else if (c == ")") {
      if (depth == 0) break
      depth--
    }
  }
  return (depth == 0) ? i - 1 : 0
}
# Returns the length of the link reference definition at the start of text, through its line end,
# or 0 when text starts with none. A label holds at most 999 characters between its brackets.
function definition_length(text, n, rest, d) {
  if (!match(text, label) || RLENGTH - 3 > 999) return 0
  n = RLENGTH
  rest = substr(text, n + 1)
  match(rest, /^[ \t]*\n?[ \t]*/)
  n += RLENGTH
  rest = substr(rest, RLENGTH + 1)
  if (match(rest, angle_destination)) d = RLENGTH
  else d = bare_destination_length(rest)
  if (d == 0) return 0
  n += d
  rest = substr(rest, d + 1)
  if (match(rest, titled_end) || match(rest, /^[ \t]*(\n|$)/)) return n + RLENGTH
  return 0
}
# Returns the index of the first paragraph line that no link reference definition holds.
function first_text_line(text, i, k, n, matched_text, newlines) {
  text = lines[1]
  for (i = 2; i <= line_count; i++) text = text "\n" lines[i]
  k = 0
  while (text != "" && (n = definition_length(text)) > 0) {
    matched_text = substr(text, 1, n)
    newlines = gsub(/\n/, "\n", matched_text)
    k += (substr(matched_text, n) == "\n") ? newlines : newlines + 1
    text = substr(text, n + 1)
  }
  return k + 1
}
# Closes the open leaf block, and prints a top-level paragraph over the warning limit.
function flush(i, first, words, parts) {
  if (leaf == "para" && para_depth == 0) {
    first = first_text_line()
    words = 0
    for (i = first; i <= line_count; i++) words += split(lines[i], parts)
    if (words > warn) print start_file":"line_numbers[first]":"words
  }
  leaf = ""
  line_count = 0
}
function add_line(s) {
  lines[++line_count] = s
  line_numbers[line_count] = FNR
}
# Starts a block after the last matched container: closes the containers left unmatched and the
# open leaf, and marks the enclosing list item as holding a block.
function begin_block() {
  flush()
  para_matched = 0
  depth = matched
  if (depth > 0) has_child[depth] = 1
}
function open_container(type, width) {
  begin_block()
  depth++
  matched = depth
  kind[depth] = type
  width_of[depth] = width
  has_child[depth] = 0
}
# Matches the open containers against the line from position p, as CommonMark does: a quote needs
# a > after at most 3 spaces, and a list item needs its content indent, or a blank line once it
# holds a block.
function match_containers(i, sp) {
  matched = 0
  for (i = 1; i <= depth; i++) {
    sp = spaces_at(L, p)
    if (kind[i] == "quote") {
      if (sp > 3 || substr(L, p + sp, 1) != ">") return
      p += sp + 1
      if (substr(L, p, 1) == " ") p++
    } else if (substr(L, p) ~ /^ *$/) {
      if (!has_child[i]) return
      p = length(L) + 1
    } else {
      if (sp < width_of[i]) return
      p += width_of[i]
    }
    matched++
  }
}
# Tries the block starts at position p and opens each one found. Returns 1 when the rest of the
# line belongs to a block it started, and 0 when the line is still to place.
function start_blocks(sp, t, m, h, mlen, rest, gap, number) {
  while (1) {
    sp = spaces_at(L, p)
    t = substr(L, p + sp)
    if (t == "") return 0
    if (sp >= 4) {
      if (leaf == "para") return 0
      begin_block()
      leaf = "code"
      return 1
    }
    if (substr(t, 1, 1) == ">") {
      open_container("quote", 0)
      p += sp + 1
      if (substr(L, p, 1) == " ") p++
      continue
    }
    if (is_atx(t)) {
      begin_block()
      return 1
    }
    m = fence_open(t)
    if (m != "") {
      begin_block()
      leaf = "fence"
      fence = m
      return 1
    }
    h = html_start(t)
    if (h != "" || (leaf != "para" && is_lone_tag(t))) {
      begin_block()
      if (h == "" || h == "block") leaf = "htmlblock"
      else if (h != "closed") {
        leaf = "html"
        html_end = h
      }
      return 1
    }
    if (para_matched && is_setext_underline(t)) {
      # A paragraph of link definitions alone has no text to underline, so the line is text.
      if (first_text_line() > line_count) return 0
      leaf = ""
      line_count = 0
      return 1
    }
    if (para_matched && is_table_delimiter(t) && cell_count(t) == cell_count(lines[line_count])) {
      line_count--
      flush()
      leaf = "table"
      return 1
    }
    if (is_thematic(t)) {
      begin_block()
      return 1
    }
    if (match(t, /^([-*+]|[0-9]+[.)])([ \t]|$)/)) {
      match(t, /^([-*+]|[0-9]+[.)])/)
      mlen = RLENGTH
      number = substr(t, 1, mlen - 1)
      rest = substr(t, mlen + 1)
      gap = spaces_at(rest, 1)
      if (mlen > 10 && number ~ /^[0-9]+$/) return 0
      if (para_matched && (rest ~ /^ *$/ || (number ~ /^[0-9]+$/ && number + 0 != 1))) return 0
      if (rest ~ /^ *$/ || gap >= 5) gap = 1
      open_container("item", sp + mlen + gap)
      p += sp + mlen + gap
      continue
    }
    return 0
  }
}
# A CRLF file ends each line in a carriage return, which is part of the line ending, not the line.
{ sub(/\r$/, "") }
FNR == 1 {
  flush()
  depth = 0
  front = ($0 == "---")
  if (front) next
}
front {
  if ($0 == "---") front = 0
  next
}
{
  L = detab($0)
  p = 1
  match_containers()
  all = (matched == depth)
  t = substr(L, p)
  if (all && leaf == "fence") {
    if (spaces_at(L, p) < 4 && fence_closes(fence, substr(t, spaces_at(L, p) + 1))) leaf = ""
    next
  }
  if (all && leaf == "html") {
    if (tolower(t) ~ html_end) leaf = ""
    next
  }
  if (all && leaf == "htmlblock") {
    if (t ~ /^ *$/) leaf = ""
    next
  }
  if (all && leaf == "code") {
    if (t ~ /^ *$/ || spaces_at(L, p) >= 4) next
    leaf = ""
  }
  para_matched = (all && leaf == "para" && t !~ /^ *$/)
  if (start_blocks()) next
  t = substr(L, p)
  sub(/^ +/, "", t)
  # A lazy line continues a paragraph left open in a container that this line did not match.
  if (depth > matched && leaf == "para" && t != "") {
    add_line(t)
    next
  }
  if (depth > matched) {
    flush()
    depth = matched
  }
  if (t == "") {
    flush()
    next
  }
  if (leaf == "para") {
    add_line(t)
    next
  }
  if (leaf == "table") next
  flush()
  if (depth > 0) has_child[depth] = 1
  leaf = "para"
  para_depth = depth
  start_file = file_name()
  add_line(t)
}
END { flush() }
'

changed=$'\n'
while IFS= read -r -d '' file; do
  changed+=$file$'\n'
done < <(list_changed)

# The Markdown files the paths name that the branch changes, each as ./<path> from list_markdown.
paragraph_files=()
while IFS= read -r -d '' file; do
  if [[ $changed == *$'\n'"${file#./}"$'\n'* ]]; then
    paragraph_files+=("$file")
  fi
done < <(list_markdown "$@")

paragraphs=
if [ "${#paragraph_files[@]}" -gt 0 ]; then
  paragraphs=$(awk -v warn="$paragraph_warn" "$fence_awk$paragraph_awk" "${paragraph_files[@]}")
fi

report "Paragraphs over $paragraph_fail words in a changed file (split each one; lists, tables and code blocks are exempt):" \
  "$(awk -F: -v limit="$paragraph_fail" '$NF > limit { print $0" words" }' <<< "$paragraphs")"

candidate "Paragraphs over $paragraph_warn words in a changed file (warning; reread each one and split it where it defends a decision):" \
  "$(awk -F: -v limit="$paragraph_fail" '$NF != "" && $NF <= limit { print $0" words" }' <<< "$paragraphs")"

candidate 'Candidates — filler words with term-of-art uses; cull the filler, keep the terms:' \
  "$(grep_docs -nPi '\b(naturally|cleanly|trivially|easy|simple|quick)\b' -- "$@")"

candidate 'Candidates — speech verbs on data artifacts; the artifact holds, includes, returns, or matches:' \
  "$(grep_docs -nPi '(?<!file |table |column |export |bucket |method |variable |test )\b(names|says|tells|answers|knows|promises)\b(?! (rot|and locations|only))' -- "$@")"

candidate 'Candidates — delta-framing words; legal only when the baseline sits in the same doc:' \
  "$(grep_docs -nPi '(^|\. )(Also|Additionally|In addition),? |\b(already|today|before this work|as it does today)\b' -- "$@")"

candidate 'Candidates — headings written as claims; move the thesis into the first sentence:' \
  "$(grep_docs -nP '^#{2,4} (?!(What|Why|When|How|Before|Where|Which)\b).*\b(is|are|does|has|cannot|never|not)\b' -- "$@")"

candidate 'Candidates — sentence-initial "A x is a" definitions; keep one only where the reader needs the term defined:' \
  "$(grep_docs -nP '\bAn? \w+ is an? ' -- "$@")"

candidate 'Candidates — contrast frames, counted lists and stock openers; state the move, name the items, open with the job:' \
  "$(grep_docs -nPi ', not (a|an|the|its|their|from|for|to|in|on|by|only|just)\b|\brather than\b|\bis not the (job|point)\b|\b(two|three|four|five) (ways|traps|mistakes|things|rules)\b|^(This|The) skill (is|helps|lets|explains|finds|builds|shows)\b' -- "$@")"

if [ "$fail" -eq 0 ]; then
  echo 'check-prose: clean (candidates above, if any, need judgment only)'
fi

exit "$fail"
