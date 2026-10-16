
# Enable prefix value candidates only after a complete, recognized option name.
function __fish_rauto_prefix_value
    set -l pending ''
    set -l words (commandline -opc)
    for word in $words[2..-1]
        if test -n "$pending"
            set pending ''
            continue
        end
        set -l name (string split -m 1 = -- $word)[1]
        set -l kind (__fish_rauto_prefix_option $name)
        or return 1
        if test "$kind" = value; and not string match -q -- '*=*' $word
            set pending $name
        end
    end
    if test -z "$pending"
        set -l current (commandline -ct)
        string match -q -- '-*=*' "$current"; or return 1
        set pending (string split -m 1 = -- $current)[1]
    end
    contains -- "$pending" $argv
end
