#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TOTAL_PROCESSED=0
TOTAL_SKIPPED=0
FILES_WITH_ERRORS=0
TOTAL_INVALID_ANCHORS=0

slugify() {
    local text="$1"
    
    # 1. 處理開頭 # 與前後空白
    text=$(echo "$text" | sed 's/^#*//' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

    # 2. 處理 Markdown Link: [Text](Link) -> Text
    text=$(echo "$text" | sed -E 's/\[([^]]+)\]\([^)]+\)/\1/g')

    # 3. 轉小寫
    text=$(echo "$text" | tr '[:upper:]' '[:lower:]')

    # 4. 【核心抹除規則】抹除 () + ' `
    text=$(echo "$text" | sed 's/[()+`'\'']//g')

    # 5. 將「每一個」空格轉為「一個」橫線 (不壓縮)
    text=$(echo "$text" | sed 's/[[:space:]]/-/g')

    # 6. 【最後清理】保留小寫英數、橫線 -、底線 _
    text=$(echo "$text" | sed 's/[^a-z0-9_-]//g')

    echo "$text"
}

check_markdown_files() {
    local target_dir="${1:-.}"

    while read -r file; do
        filename=$(basename "$file")
        
        if [[ ! "$filename" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2} ]]; then
            printf "${YELLOW}[SKIP]${NC} %s (Invalid prefix)\n" "$file"
            ((TOTAL_SKIPPED++))
            continue
        fi

        ((TOTAL_PROCESSED++))
        printf "${BLUE}[PROCESS]${NC} %s\n" "$file"

        declare -A headlines_map
        declare -a headlines_list
        file_has_error=false
        
        while IFS= read -r line; do
            if [[ "$line" =~ ^#+[[:space:]]+ ]]; then
                slug=$(slugify "$line")
                
                if [[ -z "$slug" ]]; then continue; fi

                if [[ -n "${headlines_map[$slug]}" ]]; then
                    count=${headlines_map[$slug]}
                    final_slug="${slug}-${count}"
                    headlines_map[$slug]=$((count + 1))
                else
                    final_slug="$slug"
                    headlines_map[$slug]=1
                fi
                headlines_list+=("$final_slug")
            fi
        done < "$file"

        while read -r anchor; do
            if [[ -z "$anchor" ]]; then continue; fi
            
            found=false
            for h in "${headlines_list[@]}"; do
                if [[ "$h" == "$anchor" ]]; then
                    found=true
                    break
                fi
            done

            if [ "$found" = true ]; then
                printf "  ${GREEN}[OK]${NC} Anchor: #%s\n" "$anchor"
            else
                printf "  ${RED}[FAIL]${NC} Missing: #%s\n" "$anchor"
                ((TOTAL_INVALID_ANCHORS++))
                file_has_error=true
            fi
        done < <(grep -o '(#\([^)]*\))' "$file" | sed 's/(#\(.*\))/\1/')

        if [ "$file_has_error" = true ]; then
            ((FILES_WITH_ERRORS++))
        fi

    done < <(find "$target_dir" -type f -name "*.md")

    # 統計顏色邏輯
    local ERR_COLOR=$NC
    if [ "$TOTAL_INVALID_ANCHORS" -gt 0 ]; then
        ERR_COLOR=$RED
    else
        ERR_COLOR=$GREEN
    fi

    echo "------------------------------------------"
    printf "${BLUE}Scan Summary:${NC}\n"
    printf "Total files processed: ${GREEN}%d${NC}\n" "$TOTAL_PROCESSED"
    printf "Total files skipped:   ${YELLOW}%d${NC}\n" "$TOTAL_SKIPPED"
    printf "Files with errors:     ${ERR_COLOR}%d${NC}\n" "$FILES_WITH_ERRORS"
    printf "Total invalid anchors: ${ERR_COLOR}%d${NC}\n" "$TOTAL_INVALID_ANCHORS"

    # Return status: 0 if no errors, 1 otherwise
    [ "$TOTAL_INVALID_ANCHORS" -eq 0 ] && return 0 || return 1
}

check_markdown_files "./_posts"
exit $?
