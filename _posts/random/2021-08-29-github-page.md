---
title: 自架部落格 - 使用 GitHub Pages 以及 Jekyll Chirpy 為例
date: 2021-08-29
categories: [random]
tags: [github, blog]
math: true
---

# What is GitHub Pages
GitHub 提供了一個免費的服務 - Github Pages，可以讓開發者建立屬於自己的專屬部落格網站\
沒錯 是完全免費!

只不過，GitHub Pages 僅提供靜態網頁的服務，也就是說如果你想要做註冊、登入以及其他後端功能是沒辦法的哦

# How to build GitHub Pages
首先，先建立一個新的 `repository` 名字必須要是 `USERNAME.github.io`\
![](/assets/img/posts/github-page1.png)\
由於我已經有這個 repo 了所以會有紅字，如果是第一次撰寫則不會有這個問題

新增一個簡單的 `index.html` 內容如下

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Hello GitHub</title>
  </head>
  <body>
    <h1>我的第一個 html</h1>
  </body>
</html>
```

然後之後的操作就跟一般使用 git 的方法一樣\
將新的檔案 commit, push 到 github 就完成啦\
你的新部落格網址會是 `USERNAME.github.io`

新的修改需要等一下才會顯示在你的部落格上面(以我自己的例子約莫半個小時就會有了)

# Customize GitHub Pages
如同一般撰寫網站一樣，我們也可以客製化網站的樣貌，github page 有預設一些模板可以供你使用\
你可以在 `settings->pages` 裡面找到\
![](https://docs.github.com/assets/images/help/pages/select-theme.png)
其實官方提供的選擇不多，如果你想要自己寫或是其他人寫的模板該怎麼辦?\
[Jekyll Themes](http://jekyllthemes.org/) 裡面有很多種選擇，你可以依照自己的喜好套用模板\

# Jekyll Chirpy
我選擇的是 [jekyll-theme-chirpy](http://jekyllthemes.org/themes/jekyll-theme-chirpy/) 這個主題，套用方式很簡單\
按照官方說明，首先先把 [chirpy repository](https://github.com/cotes2020/jekyll-theme-chirpy) fork 到你的 github 並且將專案名稱更改為 `USERNAME.github.io` 即可\
然後設定 build(參照 [deploy on github pages](https://github.com/cotes2020/jekyll-theme-chirpy#deploy-on-github-pages))

> Ensure your Jekyll site has the file .github/workflows/pages-deploy.yml. Otherwise, create a new one and fill in the contents of the workflow file, and the value of the on.push.branches should be the same as your repo's default branch name.
>
> Ensure your Jekyll site has file tools/test.sh and tools/deploy.sh. Otherwise, copy them from this repo to your Jekyll site.

- 首先是檔案上述檔案要設定好
- Github Action 要設定好
- build source 要設定好
  - ![](https://camo.githubusercontent.com/d15855ed187b5dffcf2408679f0abdfafb535ad17380d9b7a92e58b34329210e/68747470733a2f2f63646e2e6a7364656c6976722e6e65742f67682f636f746573323032302f6368697270792d696d616765732f706f7374732f32303139303830392f67682d70616765732d736f75726365732e706e67)

如果網頁並沒有正確顯示，要檢查上述步驟是否有漏掉\
可能你已經發現了，chirpy 是使用 markdown 語法寫網頁，所以他在 build 的時候會使用 markdown compiler 將 `.md` 轉換為 `.html`(因此我們需要使用 GitHub Action 進行編譯以及部屬)

# Highly customized your github page
細心的你肯定發現到，我的 github page 怎麼跟預設的樣板不太一樣\
因為我還有另外對他的 source code 進行修改

主要更改的地方就是 side bar 顏色、side bar layout 以及 預設圖片的更改\
以及最重要的，更新 `font-family`\
因為原本預設是使用 `微軟雅黑體`，而這個字體在顯示繁體中文的時候會有高底差的問題\
網站內容已經全部改成使用 [思源黑體](https://fonts.google.com/specimen/Noto+Sans+TC?preview.text_type=custom) 了

除了上述的改動之外\
你也可以在本機環境嘗試更改這些內容 客製化你的網頁

最後 chirpy 也提供了本機的開發環境(docker)，這樣就不用每次都需要 push 到 production 進行測試了\
可以使用以下指令將測試環境跑起來(並且它會隨著檔案的更動自動重新 build，讓你看到最即時的改動)

```shell
$ cd PROJECT_ROOT
$ docker run -it --rm --volume="$PWD:/srv/jekyll" -p 4000:4000 jekyll/jekyll jekyll serve
```

# Reference
- [Websites for you and your projects.](https://pages.github.com/)
- [Adding a theme to your GitHub Pages site with the theme chooser](https://docs.github.com/en/pages/getting-started-with-github-pages/adding-a-theme-to-your-github-pages-site-with-the-theme-chooser)
