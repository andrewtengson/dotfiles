#!/bin/bash

set -eao pipefail

install_brew_packages() {
  if ! command -v brew &> /dev/null; then
    echo "Homebrew not found. Please install it first."
    return 1
  fi

  echo "Installing brew taps..."
  mapfile -t taps < <(grep -v '^$' "$script_dir/brew/taps.txt")
  for tap in "${taps[@]}"; do
    echo "  Adding tap: $tap"
    brew tap "$tap" || true
  done

  echo "Installing brew leaves..."
  mapfile -t formulas < <(grep -v '^$' "$script_dir/brew/leaves.txt")
  if [[ ${#formulas[@]} -gt 0 ]]; then
    brew install "${formulas[@]}" || true
  fi

  echo "Installing brew casks..."
  mapfile -t casks < <(grep -v '^$' "$script_dir/brew/casks.txt")
  if [[ ${#casks[@]} -gt 0 ]]; then
    brew install --cask "${casks[@]}" || true
  fi

  echo "Brew packages installation complete."
}

# dotfiles
create_symlink() {
  file=$1
  src="$PWD/$file"
  dst="$HOME/$file"

  if ! [[ -f "$dst" ]]; then
    if ! [[ -d "$(dirname "$dst")" ]]; then
      mkdir -p "$(dirname "$dst")"
    fi

    echo "Creating $dst symlink..."
    ln -sfn "$src" "$dst"
  fi
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
  if ! "$(which brew)"; then
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

if [[ "$INSTALL_BREW" == true ]]; then
  install_brew_packages
fi
