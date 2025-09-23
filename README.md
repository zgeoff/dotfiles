# dotfiles

![Github Actions CI workflow status](https://github.com/meatwallace/dotfiles/actions/workflows/ci.yml/badge.svg?branch=main)

personal config for Arch & MacOS.

- modern unix utils
- neovim
- zellij

<!-- preview image here -->

to run the latest setup script, execute the following in your terminal:

```sh
curl https://dotfiles.geoffwhatley.com | bash
dotfiles bootstrap
dotfiles setup
```

## Post-Setup Notes

SSH & PGP:

```sh
# 1. put public and private SSH keys in ~/.ssh/id_.pub and ~/.ssh/id, respectively
touch .ssh/id
touch .ssh/id.pub

# 2. fix the file permissions to make the ssh agent happy
chmod 600 .ssh/id
chmod 600 .ssh/id.pub

# 3. load the ssh agent and add the key
eval "$(ssh-agent -s)"
ssh-add .ssh/id

# 4. put private GPG key into ~/gpg.asc, load it from disk then remove it
touch ~/gpg.pub
touch ~/gpg.key
gpg --import ~/gpg.pub
gpg --import ~/gpg.key
rm -f ~/gpg.pub
rm -f ~/gpg.key

# 5. restart the gpg agent
killall gpg-agent
gpg-agent --daemon
```

