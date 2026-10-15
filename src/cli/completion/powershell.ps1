Register-ArgumentCompleter -Native -CommandName rauto,rauto.exe -ScriptBlock ({
    param($wordToComplete, $commandAst, $cursorPosition)

    $words = [Collections.Generic.List[string]]::new()
    foreach ($element in $commandAst.CommandElements) {
        if ($element.Extent.StartOffset -ge $cursorPosition) { break }
        if ($element.Extent.EndOffset -gt $cursorPosition) {
            $partial = $element.Extent.Text.Substring(0, $cursorPosition - $element.Extent.StartOffset)
            if ($partial.StartsWith("'") -or $partial.StartsWith('"')) {
                $tokens = $null
                $parseErrors = $null
                $parsed = [Management.Automation.Language.Parser]::ParseInput($partial, [ref]$tokens, [ref]$parseErrors)
                $literal = $parsed.Find({ param($node)
                    $node -is [Management.Automation.Language.StringConstantExpressionAst] -or
                    $node -is [Management.Automation.Language.ExpandableStringExpressionAst]
                }, $true)
                if ($null -ne $literal) { $partial = $literal.Value }
            }
            $words.Add($partial)
            break
        }
        elseif ($element -is [Management.Automation.Language.StringConstantExpressionAst]) {
            $words.Add($element.Value)
        }
        else { $words.Add($element.Extent.Text) }
    }
    if ($wordToComplete -eq '') { $words.Add('') }
    $current = $words[$words.Count - 1]
    $command = $rautoStaticCompletionSpec
    $pending = $null
    $positional = 0
    $optionsEnded = $false
    for ($i = 1; $i -lt $words.Count - 1; $i++) {
        $word = $words[$i]
        if ($null -ne $pending) { $pending = $null; continue }
        if ($optionsEnded) { $positional++; continue }
        if ($word -eq '--') { $optionsEnded = $true; continue }
        if ($word.StartsWith('-')) {
            $name = ($word -split '=', 2)[0]
            $option = $command.options | Where-Object { $_.names -ccontains $name } | Select-Object -First 1
            if ($null -ne $option -and $option.takes_value -and -not $word.Contains('=')) { $pending = $option }
            continue
        }
        $child = $command.commands | Where-Object { $_.names -ccontains $word } | Select-Object -First 1
        if ($null -ne $child) { $command = $child; $positional = 0 }
        else { $positional++ }
    }

    $candidates = [Collections.Generic.List[object]]::new()
    $valuePrefix = ''
    if ($null -eq $pending -and -not $optionsEnded -and $current.StartsWith('-') -and $current.Contains('=')) {
        $name = ($current -split '=', 2)[0]
        $pending = $command.options | Where-Object { $_.names -ccontains $name } | Select-Object -First 1
        $valuePrefix = $name + '='
    }
    if ($null -ne $pending) {
        foreach ($value in $pending.values) { $candidates.Add(@{ value = $valuePrefix + $value; help = $pending.help }) }
    }
    else {
        if (-not $optionsEnded) {
            foreach ($child in $command.commands) {
                foreach ($name in $child.names) { $candidates.Add(@{ value = $name; help = $child.help }) }
            }
            if ($current -eq '' -or $current.StartsWith('-')) {
                foreach ($option in $command.options) {
                    foreach ($name in $option.names) { $candidates.Add(@{ value = $name; help = $option.help }) }
                }
            }
        }
        if ($positional -lt $command.positionals.Count) {
            foreach ($value in $command.positionals[$positional]) { $candidates.Add(@{ value = $value; help = $value }) }
        }
    }
    foreach ($candidate in $candidates) {
        if ($candidate.value.StartsWith($current, [StringComparison]::OrdinalIgnoreCase)) {
            $help = if ($candidate.help) { $candidate.help } else { $candidate.value }
            [Management.Automation.CompletionResult]::new($candidate.value, $candidate.value, 'ParameterValue', $help)
        }
    }
}.GetNewClosure())
Remove-Variable rautoStaticCompletionSpec
