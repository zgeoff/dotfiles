# before loading our ZSH profile, ensure we're in an a the right environment
if [[ ( "$SHLVL" -eq 1 && ! -o LOGIN || -z "${TMPDIR}" ) ]]; then
  . "$HOME/.bash_profile"
  . "$HOME/.zprofile"
fi

