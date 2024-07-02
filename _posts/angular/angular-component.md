---
title: 邁向 Angular 前端工程師之路 - Component
date: 2021-10-14
categories: [angular]
tags: [typescript, component]
math: true
---

# Component
![](https://angular.io/generated/images/guide/architecture/component-tree.png)

Component 是 Angular 之中最基本的概念，一個網頁上的內容可以以 component 為單位進行切割(如上圖所示)\
考慮此筆記部落格，你會發現到你可以很輕易的根據 `文章段落` 將一個網頁切割成若干部份，而你可以將其視為是單一個 component\
綜觀的來看就是，你有一個最大的 component(網頁) 裡面套了許多小部份的 component(文章段落) 這樣

# New Component
藉由 `angular-cli` 我們可以透過以下指令簡單的生成一個 component

```shell
$ ng generate component <component-name>
// or simply
$ ng g c <component-name>
```

而在該目錄底下就會生成如下資料夾

```
<component-name>
| - <component-name>.component.ts
| - <component-name>.component.html
| - <component-name>.component.scss
└── <component-name>.component.spec.ts
```

|檔名|作用|
|:--|:--|
|\<component-name\>.component.ts|component class definition|
|\<component-name\>.component.html|html template|
|\<component-name\>.component.scss|[scss](<https://en.wikipedia.org/wiki/Sass_(stylesheet_language)>) of html|
|\<component-name\>.component.spec.ts|testing specification file|

ts 檔案內容如下所示

```typescript
@Component({
  selector: "app-component-overview",
  templateUrl: "./component-overview.component.html",
  styleUrls: ["./component-overview.component.css"],
})
export class ComponentOverviewComponent {}
```

上述提到，component 是類似兜積木的方式生成網頁的，那我要如何讓 angular 知道我的這個 component 要放在哪呢？\
答案是透過 `selector`, 藉由 selector，我們可以讓 angular 明確的知道要在哪個位置插入相對的 component\
比方說，我有一個 `login.component.html` 裡面定義了如下

```html
<html>
  <head></head>

  <body>
    <app-component-overview></app-component-overview>
  </body>
</html>
```

透過這樣的方式，我們就可以將 `component-overview.component.html` 裡面的資料，**instantiate** 上去\
撰寫 template syntax 就跟我們一般撰寫 html 一樣簡單！ 只不過多了 [angular template syntax](https://angular.io/guide/template-syntax)

那 `templateUrl` 就是告訴 angular 我們要怎麼樣 **render** 網頁; 除了透過 external file 的方式，也可以使用 internal 的方式

```typescript
@Component({
    templateUrl: `<h1>hello world</h1`
})
```

而 `styleUrls` 就很明顯的，是定義 html template 的 css 囉~\
angular cli 在定義的時候提供了幾項選擇，你可以選擇使用 `css|scss|sass|less|none` 任一

注意到，component 與 class 中間不能插入任何 statement, 因為 `@Component` 是 decorators, 它 decorates class，所以記得不要在中間插入任何 statement(ref: [Typescript throws Declaration Expected error with Angular 2 component](https://stackoverflow.com/a/34524321))

# View
前面講的檔案我大概了解了，那那個 `component-overview.component.ts` 是什麼？\
[view](https://angular.io/guide/glossary#view) 是網頁上的最小顯示單元，它可以一起被生成、刪除\
而構成 view 的兩大要素就是 component class 以及 template(html)\
我們可以透過 component's application logic 使用各種 API 與 view 進行互動\
我們將會在之後的篇章中，探討如何撰寫 component logic

# ViewChild vs. ContentChild

# Child vs. Children

# References
+ [Angular Components Overview](https://angular.io/guide/component-overview)
+ [Introduction to components and templates](https://angular.io/guide/architecture-components)
+ [What's the difference between @ViewChild and @ContentChild?](https://stackoverflow.com/questions/34326745/whats-the-difference-between-viewchild-and-contentchild)
