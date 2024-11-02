#!/bin/bash

shouldExit=0
root="./_posts"

# create dummy directory to test
dummy="${root}/dummy/dummy"
mkdir -p ${dummy}

for file in $(find ${root} -name "*.md"); do
    oldIfs=$IFS
    IFS=$'\n'
    
    echo "Processing: ${file}"
    # find the (../../xxxx) in the file and store into variable
    matches=$(grep -o '](\.[^)]*)' "${file}")
    for match in ${matches}; do
        # remove the trailing # and the following characters
        fullpath=$(echo ${match} | sed 's/[()]//g' | sed 's/]//g' | sed 's/%20/-/g')

        # remove /# and any character behind it with empty string
        fullpath=$(echo ${fullpath} | sed 's/\/#.*//')
        filenameWithAnchor=$(basename ${fullpath})

        # remove anchor
        filename=$(echo ${filenameWithAnchor} | sed 's/#.*//')
        dirname=$(dirname ${fullpath})

        testPath="${dummy}/${dirname}/*-${filename}.md"

        # check if the file exists
        if ! ls ${testPath} 1> /dev/null 2>&1; then
            echo -e "\tFile not found: ${fullpath}"
            shouldExit=1
        fi
    done

    IFS=$oldIfs
done

exit ${shouldExit}
