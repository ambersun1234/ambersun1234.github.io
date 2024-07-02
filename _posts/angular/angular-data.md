---
title: 邁向前端工程師之路 - Angular 學習筆記(3) Component Input Output
date: 2021-10-16
categories: [angular]
tags: [typescript]
math: true
---

# Component parent child
Component 之間要共享資料，必須得要透過 `@Input`, `@Output` decorator 進行操作\
而 component 擁有所謂的 parent-child 關係，在一開始學習 angular 的時候我無法理解要如何判斷 component 之間的相依性(亦即 parent child)\
不過這個其實很簡單，還記得 template 是怎麼定義的嗎？

```html
<h1>
  <app-parent-component>
    <div>
      <app-child-component></app-child-component>
    </div>
  </app-parent-component>
</h1>
```

是不是與上述相似？ ㄟ這時候 你有沒有發現一件事情\
觀察上述 html template 你就可以很輕易的知道 component 之間的關係的對吧！ child component 被包附在裡面所以它為 child，那麼上層的就是 parent 囉！\
有了這個概念之後你就可以很清楚的知道如何判別 parent 以及 child 了

# Component Input
![](https://angular.io/generated/images/guide/inputs-outputs/input.svg)
{% raw %}

```typescript
// child
import { Component, Input } from "@angular/core";

export class ChildComponent {
  @Input() name = "";
}

// parent
import { Component, Output } from "@angular/core";

export class ParentComponent {
  username = "ambersun1234";
}
```

```html
<!-- <app-child-component> -->
<p>Welcome to {{name}}'s website!</p>

<!-- <app-parent-component> -->
<app-child-component [name]="username"></app-child-component>
```

`@Input` decorator 是為從 parent 傳到 child 的方法，而在 template 中可以使用 `{{ 變數名 }}` 以顯示動態資料，稱為 `interpolation binding syntax`

`[item]="username"` 是 angular 的語法，其中 `[item]` 是為輸入至 child component 的變數名(稱作 [property binding](https://angular.io/guide/property-binding)), 而 `username` 並 **_不是_** 單純的字串，他是 parent component 的變數
所以整體來看就是

```
將 parent component 中的 username 變數裡的值透過 @Input 傳入到 child component 的變數 name 中
```

{% endraw %}

# Component Output
![](https://angular.io/generated/images/guide/inputs-outputs/output.svg)
{% raw %}
`@Ouptut` decorator 是為從 child 傳到 parent 的方法，不過與 input 不一樣的是，在 output 裡面我們必須使用 `event` 的方式通知 parent

```typescript
// child
export class ChildComponent {
  @Output() newItemEvent = new EventEmitter<string>();

  addNewItem(value: string) {
    this.newItemEvent.emit(value);
  }
}

// parent
export class ParentComponent {
  addItem(input: string) {
    // to some stuff
  }
}
```

```html
<!-- <app-child-component> data -->
<label for="item-input">Add an item:</label>
<input type="text" id="item-input" #newItem />
<button (click)="addNewItem(newItem.value)">Add to parent's list</button>

<!-- <app-parent-component> -->
<app-parent-component>
  <app-child-component (newItemEvent)="addItem($event)"></app-child-component>
</app-parent-component>
```

child component 裡面，我們定義了一個 output，型態為 `EventEmitter` 並且帶了一個變數(型態為 string)\
注意到 event emitter 的使用方式，必須是使用 `newItemEvent.emit` 觸發

在 parent component 中我們透過 `event binding` 與 child event 連接起來(即: `(newItemEvent)="addItem($event)`)\
而其中 `addItem` 為 parent component function\
透過 raise event 的方法，我們就可以實現從 child 傳遞資料到 parent

![](https://angular.io/generated/images/guide/inputs-outputs/input-output-diagram.svg)
{% endraw %}

# Data binding
前面我們有稍微提到兩種 data binding 的方式，除上述兩者之外，還有另外一種 `two-way binding`

## property binding
{% raw %}

- `Property binding moves a value in one direction, from a component's property into a target element property.`

angular 透過 `[]` 這個語法糖將 html target property 包起來，並且於右手邊寫上變數名稱，用以告訴 angular 寫入數值 如下所示

```html
<img [src]="urlPath" />
```

假設 `let urlPath = "./myimage.png"`, 則上述的 template 會被 angular 解析為 `<img src="./myimage.png">`\
如果沒有加上中括號，右手邊的將會被解析成為單純的字串 :arrow_right: `<img src="urlPath>`

你也可以用 interpolation syntax 達到類似的效果

```html
<p><img src="{{itemImageUrl}}" /> is the <i>interpolated</i> image.</p>
<p><img [src]="itemImageUrl" /> is the <i>property bound</i> image.</p>
```

{% endraw %}

## event binding
event binding 可以讓我們監聽任何事件諸如 click, blur, keyup ... etc.\
event binding 的語法為 `()` 將事件名稱包起來，右手邊寫上 event handling function 即可

```html
<!-- angular -->
<button (click)="onClickListenr()"></button>

<!-- javascript -->
<button onclick="onClickListenr()"></button>
```

> 有沒有覺的寫起來跟 js 很像 ( 誤

![](https://angular.io/generated/images/guide/template-syntax/syntax-diagram.svg)

## two-way binding
如果你想要 component 裡面的 property 會自己自動更新數值，要怎麼做？\
通常是寫 input, output 手動處理對吧？\
如果你有很多個 property 要這樣做，寫起來是不是會變得很困難 於是 two-way binding 誕生了

他的 syntax 就是結合了 property binding 與 event biding :arrow_right: `[()]`\
我們來看一個簡單的例子

```typescript
// parent
fontSizePx = 16;

// child
export class ChildComponent {
  @Input() size;
  @Output() sizeChange = new EventEmitter<number>();
}
```

```html
<!-- parent -->
<app-child-component [(size)]="fontSizePx"></app-child-component>
```

為了使 two-way binding 正常做動，`@Output` 的形式必須符合 `xxxChange` 而 `@Input` 的形式必須是 `xxx`\
當你使用 two-way binding 將 `xxx` 與 parent property 綁起來之後，就可以正確做動了\
雖然說還是要寫 input/output，不過我們可以省下手動更新資料的動作了

# Getter

# Setter

# Async Pipe

# Reference
- [Sharing data between child and parent directives and components](https://angular.io/guide/inputs-outputs)
- [Property binding](https://angular.io/guide/property-binding)
- [Event binding](https://angular.io/guide/event-binding)
- [Two-way binding](https://angular.io/guide/two-way-binding)
