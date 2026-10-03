#!/usr/bin/env bash
# Delivery statusline for Claude Code.
# Reads the session JSON payload on stdin and renders a single tuned line:
#   model·effort [think]  folder dir  branch [dirty] +add-rem   PR#n state   ctx-bar   [rate]
# Nerd Font glyphs are emitted as \uXXXX escapes so the source file stays pure
# ASCII (nothing to mangle in transit); bash expands them at runtime.

payload=$(cat)

# --- glyphs (confirmed rendering in this terminal's Nerd Font) ---
G_FOLDER=$''
G_BRANCH=$''
G_PR=$''
G_CHECK=$''
G_X=$''
G_THINK=$'✳'
G_WARN=$''
DIRTY=$'●'   # ●
SEP=$'│'     # │  faint segment divider

# --- ANSI 256-color helpers ---
R=$'\033[0m'
c() { printf '\033[38;5;%sm' "$1"; }
CYAN=$(c 45); BLUE=$(c 39); GREEN=$(c 71); RED=$(c 203)
YELLOW=$(c 214); GRAY=$(c 244); DIM=$(c 240); PINK=$(c 213); MAG=$(c 170)

# --- extract fields (jq, tolerant of absent/null) ---
# One field per line, read line by line so empty fields survive (one tab-split
# `read` would collapse them, since tab is IFS whitespace). No mapfile: macOS ships bash 3.2.
F=()
while IFS= read -r line; do F+=("$line"); done < <(
  jq -r '
    [ .model.display_name // "?"
    , .effort.level // ""
    , (.thinking.enabled // false | tostring)
    , .workspace.current_dir // .cwd // ""
    , .worktree.branch // ""
    , (.cost.total_lines_added // 0 | tostring)
    , (.cost.total_lines_removed // 0 | tostring)
    , (.pr.number // "" | tostring)
    , .pr.review_state // ""
    , (.context_window.used_percentage // -1 | floor | tostring)
    , (.exceeds_200k_tokens // false | tostring)
    , (.rate_limits.five_hour.used_percentage // -1 | floor | tostring)
    , (.rate_limits.seven_day.used_percentage // -1 | floor | tostring)
    , ( .context_window.current_usage as $c
        | if $c == null
          then (.context_window.total_input_tokens // 0)
          else (($c.input_tokens // 0) + ($c.cache_creation_input_tokens // 0) + ($c.cache_read_input_tokens // 0))
          end | tostring )
    ] | .[]' <<<"$payload"
)
model=${F[0]}; effort=${F[1]}; thinking=${F[2]}; cwd=${F[3]}; wt_branch=${F[4]}
added=${F[5]}; removed=${F[6]}; pr_num=${F[7]}; pr_state=${F[8]}; ctx=${F[9]}
over200=${F[10]}; rl5=${F[11]}; rl7=${F[12]}; tokens=${F[13]}

out=""
add_seg() { [ -n "$out" ] && out+="    ${DIM}${SEP}${R}    "; out+="$1"; }


# --- folder + git branch + dirty state ---
dir=$(basename "$cwd" 2>/dev/null)
branch="$wt_branch"
[ -z "$branch" ] && branch=$(git -C "$cwd" branch --show-current 2>/dev/null)
seg="${GRAY}${G_FOLDER}${R} ${BLUE}${dir}${R}"
if [ -n "$branch" ]; then
  dirty=""
  [ -n "$(git -C "$cwd" status --porcelain 2>/dev/null)" ] && dirty=" ${RED}${DIRTY}${R}"
  bcol=$GREEN; [ -n "$dirty" ] && bcol=$YELLOW
  seg+="   ${bcol}${G_BRANCH}  ${branch}${R}${dirty}"
fi
add_seg "$seg"

# --- lines changed (hidden when zero) ---
if [ "$added" != "0" ] || [ "$removed" != "0" ]; then
  add_seg "${GREEN}+${added}${R} ${RED}-${removed}${R}"
fi

# --- pull request + review state ---
if [ -n "$pr_num" ]; then
  case "$pr_state" in
    approved)          st="${GREEN}${G_CHECK}${R}" ;;
    changes_requested) st="${RED}${G_X}${R}" ;;
    pending)           st="${YELLOW}⋯${R}"; st=$(printf '%b' "$st") ;;
    draft)             st="${GRAY}◌${R}"; st=$(printf '%b' "$st") ;;
    *)                 st="" ;;
  esac
  add_seg "${MAG}${G_PR} #${pr_num}${R} ${st}"
fi

# --- context window: token count · percent full ---
if [ "$ctx" -ge 0 ] 2>/dev/null; then
  ccol=$GREEN; [ "$ctx" -ge 50 ] && ccol=$YELLOW; [ "$ctx" -ge 75 ] && ccol=$RED
  [ "$over200" = "true" ] && ccol=$RED
  if [ "${tokens:-0}" -ge 1000 ] 2>/dev/null; then
    tok="$(( (tokens + 500) / 1000 ))k"
  else
    tok="${tokens:-0}"
  fi
  add_seg "${ccol}${tok} ${DIM}·${R} ${ccol}${ctx}%${R}"
fi

# --- usage caps: 5-hour + 7-day rolling windows, each colored by its own load ---
ratecol() {
  if [ "$1" -ge 75 ]; then printf '%s' "$RED"
  elif [ "$1" -ge 50 ]; then printf '%s' "$YELLOW"
  else printf '%s' "$GREEN"; fi
}
rate=""
[ "$rl5" -ge 0 ] 2>/dev/null && rate="${GRAY}5h${R} $(ratecol "$rl5")${rl5}%${R}"
if [ "$rl7" -ge 0 ] 2>/dev/null; then
  [ -n "$rate" ] && rate+="  ${DIM}·${R}  "
  rate+="${GRAY}7d${R} $(ratecol "$rl7")${rl7}%${R}"
fi
[ -n "$rate" ] && add_seg "$rate"

# --- model · effort · thinking (final segment) ---
mseg="${CYAN}${model}${R}"
if [ -n "$effort" ] && [ "$effort" != "medium" ]; then
  ecol=$GRAY
  case "$effort" in high) ecol=$GREEN ;; xhigh) ecol=$YELLOW ;; max) ecol=$RED ;; esac
  mseg+="${DIM}·${R}${ecol}${effort}${R}"
fi
[ "$thinking" = "true" ] && mseg+=" ${PINK}${G_THINK}${R}"
add_seg "$mseg"

# Center the whole group: left-pad by half the slack. Visible width = the
# string minus SGR escapes; -4 accounts for the statusLine padding:2.
vis_len() { local s; s=$(printf '%s' "$1" | sed $'s/\033\\[[0-9;]*m//g'); printf '%s' "${#s}"; }
cols=${COLUMNS:-120}
pad=$(( (cols - 4 - $(vis_len "$out")) / 2 ))
[ "$pad" -lt 0 ] && pad=0
printf '%*s%b' "$pad" '' "$out"
