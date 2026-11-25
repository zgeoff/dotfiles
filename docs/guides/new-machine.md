# Set up a new machine

Follow these steps to bring a new Arch, macOS or WSL machine onto the dotfiles. You copy the age key, install chezmoi, apply the repo, then put the SSH and GPG keys in place by hand. chezmoi can't decrypt the secrets in the repo without the age key, so copy the key before the first apply. On WSL, install the prompt font on the Windows side too.

## Copy the age key

Copy the age identity key to `~/.config/chezmoi/key.txt`, and give it mode 600:

```sh
chmod 600 ~/.config/chezmoi/key.txt
```

The key comes from outside the repo. Never commit it: anyone with the key can decrypt every secret in the repo.

## Install chezmoi and apply the repo

1. Install chezmoi into `~/.local/bin`:

   ```sh
   sh -c "$(curl -fsLS get.chezmoi.io)" -- -b ~/.local/bin
   ```

2. Clone the repo to `~/projects/dotfiles` over HTTPS, and apply it. The repo is public, so the clone needs no SSH key:

   ```sh
   chezmoi init --apply --source ~/projects/dotfiles https://github.com/zgeoff/dotfiles.git
   ```

3. Answer the prompts: the Git email, whether the machine has a desktop session, whether it is a personal machine, and whether it is a work machine. chezmoi remembers the answers. To change one later, run `chezmoi init` again.

The first apply installs yay or Homebrew when it is missing, then installs the packages in `home/packages/`.

## Add the SSH and GPG keys

1. Put the SSH key pair in `~/.ssh/id` and `~/.ssh/id.pub`.
2. Restrict both files, or the SSH agent refuses the key:

   ```sh
   chmod 600 ~/.ssh/id ~/.ssh/id.pub
   ```

3. Start the SSH agent and add the key:

   ```sh
   eval "$(ssh-agent -s)"
   ssh-add ~/.ssh/id
   ```

4. Point the repo's remote at SSH, so you can push:

   ```sh
   git -C ~/projects/dotfiles remote set-url origin git@github.com:zgeoff/dotfiles.git
   ```

5. Copy the GPG keys to `~/gpg.pub` and `~/gpg.key`, import them, then delete the copies:

   ```sh
   gpg --import ~/gpg.pub
   gpg --import ~/gpg.key
   rm -f ~/gpg.pub ~/gpg.key
   ```

6. Restart the GPG agent:

   ```sh
   killall gpg-agent
   gpg-agent --daemon
   ```

## Install the prompt font on WSL

On WSL, Windows Terminal draws the text, so it uses the fonts installed in Windows. A font installed inside WSL doesn't reach the prompt. The p10k prompt needs OperatorMono Nerd Font for its icons.

1. Open `\\wsl.localhost\<distro>\home\<user>\.local\share\fonts` in Explorer, where `<distro>` is the WSL distribution and `<user>` is your Linux user. `chezmoi apply` decrypts the `.otf` files there.
2. Select the `.otf` files, right-click, and choose **Install for all users**. Windows Terminal is a packaged app and can't see a font installed for one user, so a double-click install leaves it on Cascadia Mono.
3. In Windows Terminal, set the profile's font face to `OperatorMono Nerd Font`, with no space in "OperatorMono". Windows Terminal matches the exact family name.
4. Restart Windows Terminal fully, then print five glyphs:

   ```sh
   print -- $'\ue0b0 \uf00c \ue702 \uf115 \U000F0193'
   ```

   Expect a powerline arrow, a check mark, the git logo, a folder and a material icon. Cascadia Mono draws the powerline arrow too, so a box in any of the last four places means Windows Terminal still uses Cascadia Mono. When you see a box, repeat step 2, and restart Windows Terminal.

## Change the config afterwards

Edit a managed file with `chezmoi edit <target>`, or edit the live file and run `chezmoi re-add` to bring the change back into the source. chezmoi stages each changed source file in git for you. Commit and push by hand. To encrypt a new secret, add it with `chezmoi add --encrypt <file>`. For the other commands, see the [chezmoi docs](https://chezmoi.io).
