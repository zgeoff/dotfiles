# ensure path arrays do not contain duplicates
typeset -gU cdpath fpath mailpath path

# set the default Less options.
# mouse-wheel scrolling has been disabled by -X (disable screen clearing)
# remove -X and -F (exit if the content fits on one screen) to enable it
export LESS='-F -g -i -M -R -S -w -X -z-4'

# set the Less input preprocessor
# try both `lesspipe` and `lesspipe.sh` as either might exist on a system
if (( $#commands[(i)lesspipe(|.sh)] )); then
  export LESSOPEN="| /usr/bin/env $commands[(i)lesspipe(|.sh)] %s 2>&-"
fi

# if we don't have a TMPDIR variable set or it's empty, export it
if [ -z "${TMPDIR}" ]; then
  export TMPDIR="/tmp/zsh-${UID}"
fi

# if we haven't created our tmp directory, create it
if [ ! -d "${TMPDIR}" ]; then
  mkdir -m 700 "${TMPDIR}"
fi
