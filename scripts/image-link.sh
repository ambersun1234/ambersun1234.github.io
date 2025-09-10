#!/bin/bash

# Script to find all image hotlinks (external image URLs) in markdown files under _posts directory
# Usage: ./hotlink.sh
# This script uses curl to check actual HTTP response headers to determine if URLs serve images

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if _posts directory exists
if [ ! -d "_posts" ]; then
    echo -e "${RED}Error: _posts directory not found!${NC}"
    echo "Please run this script from the root directory of your Jekyll site."
    exit 1
fi

# Counter for total links found
total_links=0
error_links=0

# Find all markdown files recursively in _posts directory
while IFS= read -r -d '' file; do
    # Get relative path from _posts directory
    relative_path="${file#_posts/}"
    
    # Extract all URLs from the markdown file
    # This regex matches http/https URLs
    urls=$(grep -oE 'https?://[^[:space:]<>"'\''\)]+' "$file" 2>/dev/null)
    
    if [ -n "$urls" ]; then
        # Count links in this file
        link_count=0
        
        # Process each URL found
        while IFS= read -r url; do
            # Clean up the URL (remove trailing punctuation that might be part of markdown)
            clean_url=$(echo "$url" | sed 's/[.,;:!?)\]}>]*$//')
            
            # Skip empty URLs
            if [ -n "$clean_url" ]; then
                # Check if the URL serves an image by examining the Content-Type header
                content_type=$(curl -s -I -m 10 -w "%{content_type}" "$clean_url" 2>/dev/null | tail -n 1)
                
                # Check if content type indicates an image
                if echo "$content_type" | grep -qE '^image/'; then
                    ((link_count++))
                    ((total_links++))
                    
                    # Perform second curl with referer header to validate access
                    referer_response=$(curl -s -I -m 10 -H 'referer: https://blog.ambersuncreates.com/' -w "%{http_code}|%{content_type}" "$clean_url" 2>/dev/null)
                    referer_http_code=$(echo "$referer_response" | tail -n 1 | cut -d'|' -f1)
                    referer_content_type=$(echo "$referer_response" | tail -n 1 | cut -d'|' -f2)
                    
                    # Check for general errors (non-2xx status codes or non-image content types)
                    if [ "$referer_http_code" -lt 200 ] || [ "$referer_http_code" -ge 300 ] || ! echo "$referer_content_type" | grep -qE '^image/'; then
                        echo -e "${RED}error: ${clean_url} - access failed (HTTP ${referer_http_code}, ${referer_content_type})${NC}"
                        error_links=$((error_links + 1))
                    fi
                    
                    # Log each unique image link on a separate line
                    echo "processing ${relative_path}, link ${clean_url}"
                fi
            fi
        done <<< "$urls"
        
        if [ $link_count -eq 0 ]; then
            echo "processing ${relative_path}, no link"
        fi
    fi
done < <(find _posts -name "*.md" -type f -print0)

# Exit with appropriate code based on referer errors
if [ "$error_links" -gt 0 ]; then
    echo -e "${RED}Error: ${error_links} image links failed${NC}"
    exit 1
else
    echo -e "${GREEN}Success: ${total_links} image links checked${NC}"
    exit 0
fi