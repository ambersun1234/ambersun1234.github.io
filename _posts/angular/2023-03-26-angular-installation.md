---
title: 邁向 Angular 前端工程師之路 - Installation
date: 2023-03-26
categories: [angular]
tags: [typescript]
math: true
---

# Install Angular
這個系列都會以 `Ubuntu linux 20.04 LTS` 作為開發環境\
首先，先安裝 nodejs 以及 npm

```shell
$ sudo apt update && sudo apt upgrade -y
$ sudo apt install nodejs npm -y
```

再來就是要安裝 Angular 本身，我們需要透過 `npm` 進行安裝

```shell
$ npm install -g @angular/cli
```

因為 apt 自帶的 nodejs 版本過低，angular 所需要的版本至少為 12.20.x 或 14.15 以上，所以我們需要將 angular 進行升級\
我們可以使用 [n – Interactively Manage Your Node.js Versions](https://www.npmjs.com/package/n) 這個套件進行 nodejs 的升級

```shell
$ npm install -g n
$ n stable
```

穩定版的安裝是使用指令 `n stable`, 另外你也可以安裝最新版 `n latest`\
到目前為止，就裝好開發環境了

# Initialize application
透過以下簡單的指令，即可開啟新 angular 專案

```shell=1
$ ng new app
```

執行以上指令的時候，我遇到了以下問題(同時也在網路上找到相關討論 [angular-cli#75535](https://github.com/angular/angular-cli/issues/7735))

```
The program 'ng' is currently not installed. You can install it by typing:
sudo apt install ng-common
```

嘗試使用了 [討論區的解答](https://github.com/angular/angular-cli/issues/7735#issuecomment-345546822) 後發現會錯，於是我反反覆覆的安裝 移除 angular 很多次\
那最後的解決辦法老實說我根本沒做任何特殊的設定，不過我倒是在 stackoverflow 上找到了相對靠普的解法 [ng: command not found while creating new project using angular-cli](https://stackoverflow.com/a/47905173)，有需要可以參考看看

# Run the application
初始化專案完成後，你會看到 angular 自動幫你生成了許多檔案，不過現在可以先不用管他，在之後的系列文章中會一一探討\
現在，我們可以先把專案跑起來看看實際情況吧~

```shell=1
$ cd app
$ npm run start
```

編譯完成之後，在瀏覽器中輸入 `localhost:4200` 你應該可以看到如下圖所示的網頁\
![](https://angular.io/generated/images/guide/setup-local/app-works.png)\
到目前為止，我們就將開發環境全部設定完成了

每當你更改了 source code 的任何一個部份，angular 都會自行重新編譯過一次以及更新網頁內容

# References
+ [node 升级神器-n](https://www.jianshu.com/p/e3ca844d8d8c)
