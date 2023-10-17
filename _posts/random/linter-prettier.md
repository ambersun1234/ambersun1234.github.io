---
title: 程式碼的風格守護者 Linter 與 Prettier
date: 2023-10-16
categories: [random]
tags: [linter, prettier, coding style, javascript, eslint]
math: true
---

# Preface
我們講過關於程式碼品質的部份，可以使用測試來確保\
但是關於風格的部份，多半是在 code review 的過程中，由你的 peer 進行 review 才會被檢視

而不同的團隊，有不同的程式碼標準\
這也就導致風格不一的情況會發生\
舉例來說
+ 變數名稱是要用 camelcase 還是用 unerscore
+ public function 跟 private function 要怎麼擺
+ 哪時後要空行

如果每次 code review 都要花精力在這上面\
不但會失焦，還會浪費時間

而 Linter 以及 Prettier 是一個很好的解決方案\
這篇短文中，我會分享一些我遇到的問題，以及如何善用這類工具，增加你的生產力

# Prettier
[Prettier](https://prettier.io/) 是一個用來格式化 javascript code 的工具\
使得全部的 source code 都遵守著特定的規則\
像是要使用單/雙引號、分號還有你的 indentation 等等的

你可以透過設定檔來設定你的規則\
最基本的設定長這樣
```json
{
  "trailingComma": "es5",
  "tabWidth": 4,
  "semi": false,
  "singleQuote": true
}
```
將以上的資訊寫入 `.prettierrc` 裡面就可以了

> 注意到 prettier 並沒有所謂的全域設定檔\
> 目的在於確保不同電腦執行相同專案，可以得到相同結果

安裝方式可以使用 npm
```shell
$ npm i -D prettier
```

使用的方式也出奇的簡單
```shell
$ npx prettier . --check
or
$ npx prettier . --write
```

> 如果要指定特定資料夾，可以 `$ npx prettier './server/**/*.js' './test/**/*.js --check`

# Linter
Linter 與 Prettier 不一樣的是\
它不只能做到 format 你的程式碼，更重要的是它可以做 ***靜態檢查***

什麼意思呢？\
比方說
+ 宣告一個沒用到的變數
+ import 一個不存在的 library
+ async function 裡面沒有 await

透過 Linter 你能夠發現程式碼當中的一些潛藏問題\
而這可以避免一些 bad practice

## ESLint
> ESLint statically analyzes your code to quickly find problems.\
> It is built into most text editors and you can run ESLint as part of your continuous integration pipeline.

就如上述提到的一樣，[ESLint](https://eslint.org/) 是一個靜態檢查工具\
它主要由以下所組成

+ `Parser`
    + ESLint 預設是使用 [Espree](https://github.com/eslint/espree)\
        不過你也可以用像是 [@babel/eslint-parser](https://www.npmjs.com/package/@babel/eslint-parser) 或者是\ [@typescript-eslint/parser](https://www.npmjs.com/package/@typescript-eslint/parser)
+ `Rule`
    + ESLint 內建了許多的規則，而這些規則是用於確保你的程式碼品質的\
        比如說 [no-unused-vars](https://eslint.org/docs/latest/rules/no-unused-vars) 就可以確保不會出現定義了卻沒使用的狀況發生\
        某些 Rule 甚至有一些選項可以設定，不過這就依照不同的規則而定
+ `Plugin`
    + 對於某些你需要的功能，卻沒有內建，可以嘗試使用第三方套件或自己實做\
        像是 [@angular-eslint/eslint-plugin](https://www.npmjs.com/package/@angular-eslint/eslint-plugin) 包含了 Angular 的最佳實踐

### Installation and Run
安裝方式可以使用 npm
```shell
$ npm init @eslint/config
```

<!-- TODO -->

執行的方式
```shell
$ npx eslint .
```

### Configuration File
<!-- TODO -->

> 文章撰寫的時候，正值 ESLint Config 大改版時期\
> 若有錯誤，請不吝指教

### Multiple Parser in One Configuration File
簡單來說你無法指定多個 parser，必須分別指定\
在使用 eslint 的時候，帶入參數指定設定檔即可

```shell
$ npx eslint --config .eslint.typescript.json
```

# Git Hook
身為一個深愛自動化的工程師，手動執行檢查命令顯然有點過時\
搭配 Git Hook 的使用可以大幅度的提升工作效率

```shell
#!/bin/bash

RED='\033[0;31m'
NC='\033[0m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'

npx prettier . --check
if [ "$?" -eq 0 ]; then
    echo -e "${GREEN}Prettier all passed${NC}"
else
    echo -e "${RED}Please format the file before commit${NC}"
    exit 1
fi

npx eslint .
if [ "$?" -eq 0 ]; then
    echo -e "${GREEN}Eslint all passed${NC}"
else
    echo -e "${RED}Please format the file before commit${NC}"
    exit 1
fi
```
上述是一個簡單的 automation check 的實做\
可以看到它主要做兩件事情
1. prettier check
2. eslint check

透過檢查 command 的 return value 我們可以清楚的知道是否有任何錯誤\
搭配上不同的 colored error message 你就可以很輕易的找到問題點\
你可以選擇裝在 `pre-commit` 或 `pre-push`，我個人是兩邊都有使用

> 有關於 Git Hook 的介紹可以參考 [Git 進階使用 - Git Hook \| Shawn Hsu](../../git/git-hook)

# Example
如果你需要一個實際可以執行的範例，可以參考
<!-- TODO -->

# References
+ [Prettier](https://prettier.io/)
+ [Core Concepts](https://eslint.org/docs/latest/use/core-concepts#plugins)
+ [Getting Started with ESLint](https://eslint.org/docs/latest/use/getting-started)
