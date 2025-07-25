#!/bin/sh

set -eu

# show hidden files in finder
defaults write com.apple.finder AppleShowAllFiles true

# disable press-and-hold for keys in favor of key repeat
defaults write -g ApplePressAndHoldEnabled -bool false

# use AirDrop over every interface
defaults write com.apple.NetworkBrowser BrowseAllInterfaces 1

# open everything in finder's list view
defaults write com.apple.Finder FXPreferredViewStyle Nlsv

# show the ~/Library folder
chflags nohidden ~/Library

# set a fast key repeat.
defaults write NSGlobalDomain KeyRepeat -int 1

# set the Finder prefs for showing a few different volumes on the Desktop
defaults write com.apple.finder ShowExternalHardDrivesOnDesktop -bool true
defaults write com.apple.finder ShowRemovableMediaOnDesktop -bool true
