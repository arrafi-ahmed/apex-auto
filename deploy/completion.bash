_apex_deploy_complete() {
  local cur prev repo_root clients_dir profiles
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD-1]}"

  repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  clients_dir="$repo_root/deploy/clients"

  profiles=()
  if [[ -d "$clients_dir" ]]; then
    for dir in "$clients_dir"/*/; do
      [[ -d "$dir" ]] && profiles+=("$(basename "$dir")")
    done
  fi

  if [[ "$cur" == -* ]]; then
    COMPREPLY=( $(compgen -W "--skip-git --bootstrap --no-deploy --help" -- "$cur") )
    return 0
  fi

  COMPREPLY=( $(compgen -W "${profiles[*]}" -- "$cur") )
}
complete -F _apex_deploy_complete ./deploy.sh
complete -F _apex_deploy_complete deploy.sh
