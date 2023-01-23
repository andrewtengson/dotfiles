# Set PATH, MANPATH, etc., for Homebrew.
case "$(uname -s)" in
  "Linux") eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
  ;;
  "Darwin") eval "$(/opt/homebrew/bin/brew shellenv)"
  ;;
esac
