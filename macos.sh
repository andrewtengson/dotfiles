#!/bin/bash
set -euo pipefail

# Finder
defaults write com.apple.finder ShowPathbar -bool true
defaults write com.apple.finder ShowStatusBar -bool true
defaults write com.apple.finder FXPreferredViewStyle -string "Nlsv"
defaults write com.apple.finder NewWindowTarget -string "PfHm"

# Global
defaults write NSGlobalDomain AppleShowAllExtensions -bool true
defaults write NSGlobalDomain AppleInterfaceStyle -string "Dark"
defaults write NSGlobalDomain AppleWindowTabbingMode -string "always"
defaults write NSGlobalDomain KeyRepeat -int 2
defaults write NSGlobalDomain InitialKeyRepeat -int 25
defaults write NSGlobalDomain NSAutomaticSpellingCorrectionEnabled -bool false
defaults write NSGlobalDomain NSAutomaticCapitalizationEnabled -bool false
defaults write NSGlobalDomain NSAutomaticPeriodSubstitutionEnabled -bool false
defaults write NSGlobalDomain NSAutomaticQuoteSubstitutionEnabled -bool false
defaults write NSGlobalDomain NSAutomaticDashSubstitutionEnabled -bool false

# Dock
defaults write com.apple.dock tilesize -int 38
defaults write com.apple.dock mineffect -string "scale"
defaults write com.apple.dock show-recents -bool false

# Trackpad
defaults write com.apple.AppleMultitouchTrackpad Clicking -bool true
defaults write com.apple.driver.AppleBluetoothMultitouch.trackpad Clicking -bool true
defaults -currentHost write NSGlobalDomain com.apple.mouse.tapBehavior -int 1
defaults write NSGlobalDomain com.apple.mouse.tapBehavior -int 1

# Language Input
defaults write com.apple.HIToolbox AppleEnabledInputSources -array-add '{
    "Bundle ID" = "com.apple.inputmethod.Kotoeri.RomajiTyping";
    "Input Mode" = "com.apple.inputmethod.Japanese";
    "InputSourceKind" = "Input Mode";
}'
defaults write com.apple.HIToolbox AppleEnabledInputSources -array-add '{
    "Bundle ID" = "com.apple.inputmethod.Kotoeri.RomajiTyping";
    "InputSourceKind" = "Keyboard Input Method";
}'

# Disable Ctrl+Space input switching (conflicts with tmux)
/usr/libexec/PlistBuddy -c "Set :AppleSymbolicHotKeys:60:enabled false" ~/Library/Preferences/com.apple.symbolichotkeys.plist 2>/dev/null || true

# Restart affected apps
killall Finder Dock SystemUIServer 2>/dev/null || true
echo "macOS settings applied."
