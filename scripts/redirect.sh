#!/bin/bash

shouldExit=0

for file in $(find ./_posts -name "*.md"); do
    oldIfs=$IFS
    IFS=$'\n'

    ok=0
    for url in $(cat ${file} | head -n 10 | sed -n '/---/,/---/p' | sed -n '/redirect_from:/,$p' | grep ' -'); do
        if [[ "${url}" != */ ]]; then
            echo "invalid redirect url: '${url}' in '${file}'"
            shouldExit=1
            ok=1
        fi
    done
    IFS=$oldIfs

    if [ ${ok} -eq 0 ]; then
        echo "✅ Processing: ${file}"
    else
        echo "❌ Processing: ${file}"
    fi
done

exit ${shouldExit}
