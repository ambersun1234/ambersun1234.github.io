---
title: 邁向 Angular 前端工程師之路 - Obfuscation
date: 2023-04-12
description: Obfuscation 是一種將 source code 進行混淆的技術，目的是為了避免 source code 被輕易的破解，本文將介紹如何在 Angular 專案中使用 obfuscation
categories: [angular]
tags: [typescript, obfuscation, webpack]
math: true
---

# How Frontend Application Run in Real Life
![](https://dotblogsfile.blob.core.windows.net/user/kevinya/c43a27da-45dc-480e-bc14-4667ef15123d/1466586494_54712.jpg)
> ref: [[javascript]如何用chrome,ie去debug javascript](https://dotblogs.com.tw/kevinya/2016/06/22/171608)

如果你有曾經打開 F12(Web Developer Tool), 你可能會看過上圖的東西\
仔細觀察你會發現，不只 html, css 都可以被看見，甚至是 JavaScript 原始碼也可以看得到\
所以，我們可以做一個簡單的推論\
你所看到的網頁基本上都是由這些 source code 跑出來的

這時候問題來了\
為什麼我看得到 source code\
根據過往的經驗，我應該只需要 binary 就可以跑了不是(想想你下載一些遊戲，是不是都是 `.exe`，頂多在搭配上圖片等 assets)\
為什麼網頁的邏輯卻是直接將 source code 給 client 呢

## Interpret vs. Compiled Language
![](https://www.guru99.com/images/1/053018_0616_CompilervsI1.png)
> ref: [Compiler vs Interpreter – Difference Between Them](https://www.guru99.com/difference-compiler-vs-interpreter.html)

直譯式語言與編譯式語言最大的差別是在\
編譯式出來的會是 `machine code`, 而直譯式的會是 `intermediary code`(中間碼)

### Compiled Language
如 Golang, C, C++ 等語言都是屬於編譯式語言，所有的 source code 編譯過後會產生一個執行檔(binary)\
而這個執行檔，會綁定在特定的作業系統(i.e. windows, ubuntu)以及系統架構(x86_64, arm64)，也因此 windows 上面 compile 出來的 .exe，ubuntu 沒辦法開啟

而通常編譯式語言跑起來會比 [Interpret Language](#interpret-language) 來的快許多\
原因是直譯式的中間碼還需要在解析一次，因此跑起來會比原生的還要慢

> 可參考 Cross Compile

### Interpret Language
Python, JavaScript, Java 等等的是屬於直譯式語言，也因此他們 "直譯(interpret)" 出來會是 bytecode 的形式\
比如說 Java "直譯(interpret)" 出來會是 Java bytecode, 之後在跑在 JVM 上面

也因為直譯式語言並不會直接產出 machine code, 因此，直譯式並不會有平台或系統的限制\
只要執行環境看得懂 bytecode, 再來環境可以跑在 target os 上面\
就可以很輕鬆的達到跨平台的特性

不過缺點很明顯，因為還要將 bytecode 翻譯成 machine code，因此在執行速度上會稍嫌緩慢\
為了提高執行速度，[JIT Compiler](https://en.wikipedia.org/wiki/Just-in-time_compilation) 出現了！\
針對重複執行的程式片段，將它編譯成 machine code 以大幅度的提高執行速度

<hr>

好，所以為什麼 JavaScript 還是要以 source code 的方式運行在瀏覽器上面呢\
bytecode 不好嗎？

對，不好\
記得上面說 bytecode 需要在轉換成 machine code 執行嗎？\
也就是說所有的瀏覽器都必須要看得懂某種格式的 bytecode, 並且所有瀏覽器都必須使用相同的執行環境(像是 JVM) 來執行 bytecode\
理想很豐滿，現實很骨感\
雖然這是一個不錯的解法，但是由於歷史原因，要讓所有開發廠商全部採用相同格式本身就是一件很困難的事情(而且還牽扯到錢)\
也因此 bytecode 這條路是行不通的，所以目前的主流作法是將 source code 給 client\
讓瀏覽器自行決定是要怎麼執行，反正 JavaScript 的語言標準是通用的，跑出來肯定是相同的

# Introduction to Webpack
既然要把 source code 給 client\
那豈不是要上傳一堆東西？

![](https://preview.redd.it/tfugj4n3l6ez.png?auto=webp&v=enabled&s=b919a7283e56d929e37758af3b34e532c1a71453)
> ref: [Heaviest Objects In The Universe](https://www.reddit.com/r/ProgrammerHumor/comments/6s0wov/heaviest_objects_in_the_universe/)

看看這精美的 node_modules, 少說幾 MB, 多則好幾 GB\
先不說光是下載 package 載入都要一段時間了，我要怎麼把 package 安裝到 client 的瀏覽器上面?\
總不能在上面跑 `npm install` 吧 這不太合理

把所有 node_modules 都放上伺服器讓 client 下載？\
hmm not a good idea\
但它是一個好方向

如果能有一種方法將所有第三方的 package 縮小塞在一起給 client\
是不是就完美了

## Webpack
![](http://4.bp.blogspot.com/-f3f-l-gfQzo/Vh_F0OCuTYI/AAAAAAAAEc4/wu17dcGGiCk/s1600/what-is-webpack.png)

webpack 可以將你的 static module 全部打包在一起變成一個檔案\
注意到 webpack 僅有打包的功能，所以它並不會幫你優化程式碼之類的\
話雖如此，webpack 在進行 production build 的時候會將程式碼內的空白以及換行全部拔掉\
所以實際上 webpack 擁有可以縮小檔案大小的能力，但也僅此而已

要怎麼樣將 application 中所有用到的 package 打包起來呢？\
直觀點的思考會是，一層一層的追下去，看說你引用了哪些，而那些 package 又引用了哪些\
最後將這些做成一張地圖，稱之為 `dependency graph`

> 對於 webpack 的說明就到這裡，詳細的我會在開一篇文章下去探討\
> 本文就先專注在 obfuscation 本身上面

# Plain Text of Source Code?
終於，你成功的把 source code 全部放上去供 client 下載了\
結果你發現你的 api key 居然赤裸裸的躺在別人的瀏覽器上面\
這肯定是不行的

如果你 hard code 一些機密資訊在上面(e.g. 密碼，api key ... etc.)\
請愛用 environment variable\
這樣就可以有效的避免資訊洩漏

但如果你還是不想讓其他人看到你寫的 code\
最簡單的方式就是將它加密對吧\
加密過後的 ciphertext 除非擁有解密鑰匙，不然打開只會看到一團亂碼\
不過等等... 解密鑰匙要怎麼給 client?\
非對稱式加密感覺不錯對吧，你有一把鑰匙，我有一把鑰匙(只需要交換公鑰就可以了也挺安全的不是)\
但是你的 client 要跟全世界的 client 共用一把鑰匙？ 還是每個 client 都用自己獨一無二的 key?\
這樣做起來不覺得很麻煩嗎\
只是個 source code 不用那麼麻煩吧？ 而且做起來不符合成本

# Introduction to Obfuscation
傳說中程式設計師要搞人的話，會在 source code 這邊動一些手腳\
比如說
```c
#include <stdio.h>

int main(int argc, const char *argv[]) {
    printf("Hello World!");
    return 0;
}
```
看起來沒問題，實際上
```
a.c: In function ‘main’:
a.c:4:27: warning: `\U0000037e' is not in NFC [-Wnormalized=]
    4 |     printf("Hello World!");
      |                           ^
a.c:4:27: error: expected ‘;’ before ‘;’
    4 |     printf("Hello World!");
      |                           ^
      |
```
使用希臘文分號(U+037E, [https://www.compart.com/en/unicode/U+037E](https://www.compart.com/en/unicode/U+037E))代替原本的分號\
或者是將 1, I, l 混用等等的都有看過

把 source code 混淆好像是個好方法對吧\
在不影響程式執行結果的情況下，將 source code 混淆使得人類無法輕易的破解

<hr>

為了避免能夠輕易的讀取到 source code 的內容，主流的方法就是採用 obfuscation 的方式\
接下來來看看如何在 Angular 的專案當中使用 obfuscation 吧

## Angular Webpack Builder
首先，obfuscation 是針對最終的檔案，所以我們要先將 Angular 本身打包起來\
並針對打包後的檔案，進行混淆的操作

所以，還是 [Webpack](#webpack)\
我們可以使用 [@angular-builders/custom-webpack](https://www.npmjs.com/package/@angular-builders/custom-webpack)\
基本上他是基於 [@angular-devkit/build-angular](https://www.npmjs.com/package/@angular-devkit/build-angular) 在往上做 custom webpack\
也就是會將你自定義的 webpack config 跟原本定義的合併在一起

> 但像是 `dev-server` 它就不是使用 build-angular:dev-server 的 config

在 `angular.json` 裡面找到
```json
"architect": {
    "build": {

    },
    "serve": {

    },
    ...
}
```

architect 裡面分別對應了，當你執行 `ng build` 或 `ng serve` 的時候，它應該要用哪一種設定\
每個 entry 裡面都會有長的像下面的東西
```json
"builder": "@angular-devkit/build-angular:browser",          <---
"options": {
    "outputPath": "dist/app",
    "index": "src/index.html",
    "main": "src/main.ts",
    "polyfills": ["zone.js"],
    "tsConfig": "tsconfig.app.json",
    "inlineStyleLanguage": "scss",
    "assets": ["src/favicon.ico", "src/assets"],
    "styles": ["src/styles.scss"],
    "scripts": [],
    "customWebpackConfig": {
    "mergeRules": {
        "externals": "replace"
    }
    }
}
```
多數的設定檔都是 anglar 產生的，我們要關注的只有 `builder` 以及等等會加的 `customWebpackConfig`
1. builder 要改成 custom webpack(因為我們要自訂 obfuscation 的設定)
2. 然後還需要 webpack config 的路徑

所以 `angular.json` 會變成
```json
"builder": "@angular-builders/custom-webpack:browser",          <---
"options": {
    "outputPath": "dist/app",
    "index": "src/index.html",
    "main": "src/main.ts",
    "polyfills": ["zone.js"],
    "tsConfig": "tsconfig.app.json",
    "inlineStyleLanguage": "scss",
    "assets": ["src/favicon.ico", "src/assets"],
    "styles": ["src/styles.scss"],
    "scripts": [],
    "customWebpackConfig": {
    "path": "./webpack.config.js",                              <---
    "mergeRules": {
        "externals": "replace"
    }
    }
}
```

至於 webpack config 裡面需要放入以下內容
```js
// webpack.config.js

const JavaScriptObfuscator = require("webpack-obfuscator");
module.exports = (config, options) => {
    if (config.mode === "production") {
        config.plugins.push(
            new JavaScriptObfuscator(
                {
                    rotateStringArray: true
                },
                ["exclude_bundle.js"]
            )
        );
    }
};
```

> 這裡的語法是 CommonJS, 原生的 JS 需要到 ES6 才支援\
> 詳細的 CommonJS 可以參考 [什麼？！我們竟然有 3 個標準？ - 你有聽過 CommonJS 嗎？(Day9)](https://ithelp.ithome.com.tw/articles/10191478)

webpack 除了基礎的打包功能以外，還提供了許多的 plugin 套件供使用\
`webpack-obfuscator` 就是主要的混淆套件\
透過指令安裝
```shell
$ npm i --dev webpack-obfuscator
```

webpack config 做的事情簡單明瞭\
當 production build 的時候，將 webpack-obfuscator 加入 webpack config 裡面\
就這樣

做完以上，你所得到完成打包的 source code 就具備基礎混淆能力了！

# References
+ [Interpreted vs. compiled languages: What's the difference?](https://www.theserverside.com/answer/Interpreted-vs-compiled-languages-Whats-the-difference)
+ [Why are webpages deployed as JavaScript source code instead of compiled bytecode?](https://www.reddit.com/r/learnprogramming/comments/x01wtj/why_are_webpages_deployed_as_javascript_source/)
+ [Does JavaScript compile to binary?](https://stackoverflow.com/questions/52298637/does-javascript-compile-to-binary)
+ [Possible to compile/encode JavaScript to binary to hide code?](https://stackoverflow.com/questions/54886622/possible-to-compile-encode-javascript-to-binary-to-hide-code)
+ [Day29-JS模組化！(套件結合篇)](https://ithelp.ithome.com.tw/articles/10209683)
+ [5 Methods to Reduce JavaScript Bundle Size](https://blog.bitsrc.io/5-methods-to-reduce-javascript-bundle-size-67f2e1220457)
+ [什麼？！我們竟然有 3 個標準？ - 你有聽過 CommonJS 嗎？(Day9)](https://ithelp.ithome.com.tw/articles/10191478)
