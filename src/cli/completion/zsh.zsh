
functions[_rauto_scoped]=$functions[_rauto]
_rauto() {
    local -a words=("${words[@]}") _rauto_prefix_values
    local CURRENT=$CURRENT start=2 word name _rauto_prefix_takes_value
    while (( start < CURRENT )); do
        word=$words[start]
        name=${word%%=*}
        _rauto_prefix_option "$name" || break
        (( start += 1 ))
        if [[ $_rauto_prefix_takes_value == true && $word != *=* ]]; then
            if (( start == CURRENT )); then
                compadd -a _rauto_prefix_values
                return
            fi
            (( start += 1 ))
        fi
    done
    if (( start == CURRENT )) && [[ $words[CURRENT] == --*=* ]]; then
        name=${words[CURRENT]%%=*}
        if _rauto_prefix_option "$name" && [[ $_rauto_prefix_takes_value == true ]]; then
            compset -P '*='
            compadd -a _rauto_prefix_values
            return
        fi
    fi
    words=("$words[1]" "${(@)words[start,-1]}")
    (( CURRENT -= start - 2 ))
    _rauto_scoped "$@"
}
