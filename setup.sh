#!/bin/bash

set -eao pipefail

install_brew_packages() {
  if ! command -v brew &> /dev/null; then
    echo "Homebrew not found. Please install it first."
    return 1
  fi

  echo "Installing brew taps..."
  grep -v '^$' "$script_dir/brew/taps.txt" | while read -r tap; do
    echo "  Adding tap: $tap"
    brew tap "$tap" || true
  done

  echo "Installing brew leaves..."
  grep -v '^$' "$script_dir/brew/leaves.txt" | xargs brew install || true

  echo "Installing brew casks..."
  grep -v '^$' "$script_dir/brew/casks.txt" | xargs brew install --cask || true

  echo "Brew packages installation complete."
}

# dotfiles
create_symlink() {
  file=$1
  src="$PWD/$file"
  dst="$HOME/$file"

  mkdir -p "$(dirname "$dst")"
  ln -sfn "$src" "$dst"
  echo "Linked $dst"
}

realpath() {
  [[ $1 = /* ]] && echo "$1" || echo "$PWD/${1#./}"
}

script_dir="$(realpath "$(dirname "${0}")")"
cd "$script_dir"

# Parse command line arguments
INSTALL_BREW=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --brew)
      INSTALL_BREW=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--brew]"
      echo "  --brew    Install brew taps, casks, and leaves from brew directory"
      exit 1
      ;;
  esac
done

dotfiles=(
  ".zshrc"
  ".tmux.conf"
  ".config/nvim"
  ".config/zsh"
  ".config/kitty"
  ".config/ghostty"
)

if [[ "$(uname -s)" == "Darwin" ]] || [[ $USER == "deck" ]]; then
  if ! command -v brew &>/dev/null; then
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  fi
  create_symlink ".zprofile"
fi

for file in "${dotfiles[@]}"; do
  create_symlink "$file"
done

if [[ "$(uname -s)" == "Linux" ]]; then
  ln -sfn "$PWD/.config/ghostty-linux" "$HOME/.config/ghostty/ghostty-linux"
fi

# ai steering (kiro, claude code, codex)
mkdir -p "$HOME/.kiro/steering"
ln -sfn "$PWD/ai/steering.md" "$HOME/.kiro/steering/main.md"
mkdir -p "$HOME/.claude"
ln -sfn "$PWD/ai/steering.md" "$HOME/.claude/CLAUDE.md"
mkdir -p "$HOME/.codex"
ln -sfn "$PWD/ai/steering.md" "$HOME/.codex/AGENTS.md"

# k9s config (macOS uses ~/Library/Application Support/k9s/)
k9s_dir="$HOME/Library/Application Support/k9s"
if [[ "$(uname -s)" == "Darwin" ]]; then
  mkdir -p "$k9s_dir/skins"
  ln -sfn "$PWD/k9s/config.yaml" "$k9s_dir/config.yaml"
  ln -sfn "$PWD/k9s/skins/gruvbox.yaml" "$k9s_dir/skins/gruvbox.yaml"
else
  mkdir -p "$HOME/.config/k9s/skins"
  ln -sfn "$PWD/k9s/config.yaml" "$HOME/.config/k9s/config.yaml"
  ln -sfn "$PWD/k9s/skins/gruvbox.yaml" "$HOME/.config/k9s/skins/gruvbox.yaml"
fi

if [[ "$INSTALL_BREW" == true ]]; then
  install_brew_packages
fi
