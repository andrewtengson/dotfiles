export LC_ALL=en_US.UTF-8
export ZSH=~/.oh-my-zsh
export EDITOR=nvim
export PATH=$PATH:/usr/local/opt/openjdk/bin
export PATH=$PATH:~/Documents/projects/flutter/bin
export PATH=$PATH:~/go/bin

ZSH_THEME="agnoster-mod"

DISABLE_AUTO_UPDATE="true"
DISABLE_AUTO_TITLE="true"

plugins=(
)

source $ZSH/oh-my-zsh.sh
source ~/.config/aliasrc

vpn() {
  local pid_file="${HOME}/.openconnect.pid"
  local servercert=''
  local user=''
  local authgroup=''
  local endpoint=''

  case "${1}" in
    up)
      sudo openconnect --background --pid-file "${pid_file}" --servercert "${servercert}" --user "${user}" --authgroup "${authgroup}" "${endpoint}"
      ;;
    down)
      sudo kill -2 "$(cat "${pid_file}")" && sudo rm "${pid_file}"
      ;;
    *)
      echo "Unsupported option!"
      false
      ;;
  esac
}

totp() {
  totp_home="${HOME}/.totp/"
  key="${totp_home}/${1:-jump}.asc"

  if [[ -f ${key} ]]; then
    decrypted_key="$(gpg --decrypt "${key}")"
    oathtool --totp -b "${decrypted_key}" | pbcopy
    echo "Copied ${1} OTP to clipboard!"
  else
    echo "${key}: No such file or directory"
  fi
}

realpath() {
  [[ $1 = /* ]] && echo "$1" || echo "$PWD/${1#./}"
}

