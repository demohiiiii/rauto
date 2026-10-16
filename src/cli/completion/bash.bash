_rauto_dequote() {
    local input=$1 quote=${2:-} char next i
    REPLY=
    for ((i=0; i<${#input}; i++)); do
        char=${input:i:1}
        case "$quote" in
            "'")
                if [[ $char == "'" ]]; then quote=; else REPLY+=$char; fi
                ;;
            '"')
                case "$char" in
                    '"') quote= ;;
                    \\)
                        next=${input:i+1:1}
                        case "$next" in
                            '$'|'`'|'"'|\\|$'\n')
                                ((i+=1))
                                [[ $next == $'\n' ]] || REPLY+=$next
                                ;;
                            *) REPLY+=$char ;;
                        esac
                        ;;
                    *) REPLY+=$char ;;
                esac
                ;;
            *)
                case "$char" in
                    "'"|'"') quote=$char ;;
                    \\)
                        ((i+=1))
                        next=${input:i:1}
                        [[ $next == $'\n' ]] || REPLY+=$next
                        ;;
                    *) REPLY+=$char ;;
                esac
                ;;
        esac
    done
    _rauto_quote=$quote
}

_rauto_completion() {
    local -a original=("${COMP_WORDS[@]}") normalized=()
    local index=$COMP_CWORD i word join=false
    for ((i=0; i<=index; i++)); do
        word=${original[i]}
        case "$word" in
            =)
                # Readline separates --option=value at '='; the generator expects two words.
                if (( i == index )); then normalized+=(""); fi
                ;;
            :)
                if (( ${#normalized[@]} )); then
                    normalized[${#normalized[@]}-1]+=':'
                    join=true
                fi
                ;;
            *)
                if [[ $word == --*=* ]]; then
                    # Bash 3.2 keeps attached option values in a single word.
                    normalized+=("${word%%=*}" "${word#*=}")
                elif $join; then
                    normalized[${#normalized[@]}-1]+="$word"
                    join=false
                else
                    normalized+=("$word")
                fi
                ;;
        esac
    done
    local -a COMP_WORDS=("${normalized[@]}")
    local COMP_CWORD=$((${#normalized[@]}-1))
    # Remove syntax quotes without evaluating substitutions in the command line.
    local REPLY _rauto_quote current previous quote prefix candidate
    for ((i=0; i<=COMP_CWORD; i++)); do
        _rauto_dequote "${COMP_WORDS[i]}"
        COMP_WORDS[i]=$REPLY
    done
    quote=$_rauto_quote
    current=${COMP_WORDS[COMP_CWORD]}
    previous=${COMP_WORDS[COMP_CWORD-1]}
    # Consume shared prefix options so their values cannot become subcommands.
    local start=1 _rauto_prefix_takes_value
    local -a _rauto_prefix_values
    while (( start < COMP_CWORD )); do
        _rauto_prefix_option "${COMP_WORDS[start]}" || break
        ((start+=1))
        if [[ $_rauto_prefix_takes_value == true ]]; then
            if (( start == COMP_CWORD )); then
                COMPREPLY=( $(compgen -W "${_rauto_prefix_values[*]}" -- "$current") )
                return 0
            fi
            ((start+=1))
        fi
    done
    COMP_WORDS=("${COMP_WORDS[0]}" "${COMP_WORDS[@]:start}")
    COMP_CWORD=$((${#COMP_WORDS[@]}-1))
    # Readline removes the opening quote, but leaves backslash escapes intact.
    _rauto_dequote "$2" "$quote"
    prefix=${current%"$REPLY"}
    _rauto "$1" "$current" "$previous"
    local -a replies=("${COMPREPLY[@]}")
    COMPREPLY=()
    for candidate in "${replies[@]}"; do
        if [[ $candidate == "$prefix"* ]]; then
            candidate=${candidate#"$prefix"}
            [[ -n $candidate ]] || continue
            # Bash 3.2 has no compopt, so escape candidates for the current quote.
            if (( BASH_VERSINFO[0] < 4 )); then
                case "$quote" in
                    "'") candidate=${candidate//\'/\'\\\'\'} ;;
                    '"')
                        candidate=${candidate//\\/\\\\}
                        candidate=${candidate//\$/\\\$}
                        candidate=${candidate//\`/\\\`}
                        candidate=${candidate//\"/\\\"}
                        ;;
                    *) printf -v candidate '%q' "$candidate" ;;
                esac
            fi
            COMPREPLY+=("$candidate")
        fi
    done
}
# The generated path handlers enable filenames only when completing a path.
complete -F _rauto_completion rauto
