# execute code that does not affect the current session in the background
{
  # compile the completion dump to increase startup speed
  dump_file="$HOME/.zcompdump"

  if [[ "$dump_file" -nt "${dump_file}.zwc" || ! -s "${dump_file}.zwc" ]]; then
    zcompile "$dump_file"
  fi
} &! 

