---
title: 神奇的演算法 - 為什麼你的 Priority Queue 那麼慢！
date: 2025-02-24
categories: [algorithm]
tags: [priority queue, heap, min heap, max heap, array, linked list, realloc, golang]
description: Priority Queue 的實作方式有很多種，但是不同的實作方式會有不同的效能表現，這篇文章會介紹 Priority Queue 的基本概念，以及不同實作方式的差異
math: true
---

# Introduction to Priority Queue
針對需要存取一個陣列內，最大或最小值的方法，常見的第一直覺是 `sorting`\
但每次存取每次排序顯然不好，於是有了 `Priority Queue` 這個資料結構

與其每次都排序，不如我維護一個 `有序的資料結構`，就是 priority queue 的基本思想\
它不一定要是依照大小排列，你可以自定義排序方式\
比如說你可以做到，奇數 index 的數值小到大，偶數 index 的數值大到小\
這類奇特的排序需求

# Implementation
實作上有分為以下幾種方式\
[Array](#array) 與 [Linked List](#linked-list) 是最直覺的方式\
他們的時間複雜度是
1. 寫入/刪除: $O(n)$
2. 查詢: $O(1)$

即使複雜度一樣，但是實作起來不同的語言會有不同的差異\
以實作方便程度來說，Array 會比 Linked List 簡單很多\
但是 Array 需要考慮重新配置記憶體的問題(i.e. `realloc`)

[Heap](#heap) 則是速度最快的實作\
其寫入/刪除的時間複雜度可以被縮減為 $O(\log n)$

> $O(\log n)$ 是代表每次運算可以篩掉一半的數量

## Array
```go
func insert(q []int, value int) []int {
    var index int

    for index = 0; index < len(q); index++ {
        if q[index] > value {
            break
        }
    }

    first := append([]int{}, q[:index]...)
    second := append([]int{}, q[index:]...)

    return append(append(first, value), second...)
}

func pop(q []int, index int) []int {
    q = append([]int{-1}, q...)
    index += 1

    first := append([]int{}, q[:index]...)
    second := append([]int{}, q[index + 1:]...)

    return append(first, second...)[1:]
}

func main() {
    priorityQueue := make([]int, 0)

    for _, num := range nums {
        priorityQueue = insert(priorityQueue, num)
    }

    priorityQueue = pop(priorityQueue, 0)
}
```

實作上就如上所示，找到合適的位置插入/刪除即可\
透過 Golang 的 slice 可以不需要手動計算所需的記憶體大小，寫起來也比較方便

你可能會好奇，為什麼不論是 insert 或者是 pop 我都重新配置一塊記憶體呢(i.e. `append([]int{})`)？\
原因在於說，如果直接拿原始陣列 append 起來，會去更改到原本的記憶體內容，造成資料不一致的行為

## Linked List
```go
type node struct {
    value int
    next *node
}

type pq struct {
    head *node
}

func (q *pq) add(root *node) {
    sentinel := &node{next: q.head}
    previous := sentinel
    current := q.head

    for current != nil && current.value < root.value {
        previous = current
        current = current.next
    }

    previous.next = root
    root.next = current

    q.head = sentinel.next
}

func (q *pq) pop(index int) {
    sentinel := &node{next: q.head}
    previous := sentinel
    current := q.head

    count := 0
    for current != nil && count != index {
        previous = current
        current = current.next
        count += 1
    }

    previous.next = current.next
    q.head = sentinel.next
}

func main() {
    q := &pq{head: nil}

    for _, num := range nums {
        q.add(&node{value: num, next: nil})
    }
    q.pop(0)
}
```

Linked List 的實作也相對直覺\
透過一個 for-loop 遍歷整個 List 尋找適合插入/刪除的位置(這點跟 [Array](#array) 的實作如出一徹)\
注意到，為了更優雅的處理邊界條件(也就是 previous 是 nil 的時候)\
使用 if 判斷是一個合理的選項，但不優雅，所以這邊透過一個 dummy node 來處理(時間換空間)

## Heap
```go
func swap(h []uint64, i, j int) []uint64 {
    tmp := h[i]
    h[i] = h[j]
    h[j] = tmp

    return h
}

func insert(h []uint64, num uint64) []uint64 {
    h = append(h, num)
    i := len(h) - 1

    for i > 0 {
        parent := (i - 1) / 2
        if h[i] < h[parent] {
            h = swap(h, i, parent)
            i = parent
        } else {
            return h
        }
    }

    return h
}

func pop(h []uint64, index int) []uint64 {
    last := len(h) - 1

    h[0] = h[last]
    h = h[:last]
    size := len(h)

    for index < size {
        left := 2 * index + 1
        right := 2 * index + 2

        smallest := index
        if left < size && h[smallest] > h[left] {
            smallest = left
        }
        if right < size && h[smallest] > h[right] {
            smallest = right
        }

        if smallest != index {
            h = swap(h, index, smallest)
            index = smallest
        } else {
            return h
        }
    }

    return h
}

func main() {
    h := make([]uint64, 0)

    h = insert(h, uint64(7))
    h = insert(h, uint64(23))
    h = insert(h, uint64(4))
    h = insert(h, uint64(12))
}
```

> 本例 Min Heap 是使用 Array 來實作(當然也可以用 Linked List)

Heap 本質上是一個 **完全二元樹**(complete binary tree)\
注意到它跟 binary search tree 是不同的，Heap 同一層的數值沒有大小之間的關係\
也就是說，只有不同 level 之間的數值才有分大小

> 完全二元樹，節點之間不會有空缺

同一層的數值沒有大小區分 :arrow_right: 這件事情其實很有趣\
如果你把 Heap 的數值照順序畫出來，你會發現到你並沒有辦法得到一個有序的陣列\
這代表 Heap 沒辦法給定排序的結果嗎？ 其實不然

Heap 是透過寫入/刪除的 **過程**，確保這個 "排序" 依然有效

### Update Process
既然 Heap 借鑒了二元樹的想法，那麼更新的方式也是類似\
只不過是\
寫入的時候，我們是從 **最後一個節點** 開始往上更新\
刪除的時候，我們是從 **root** 開始往下更新

這個條件，依據 `Min Heap` 或 `Max Heap` 來決定
+ `Min Heap` : 父節點的數值小於子節點
+ `Max Heap` : 父節點的數值大於子節點

> 不同的 Heap 他的根節點會是最大或最小的數值

<hr>

不過如果在更新的過程中，兩邊 child 都可以選擇的時候該怎麼辦？\
考慮以下刪除的例子(100 被換到 root 的位置然後開始往下更新)
```
       100
     /     \
    30      10
   / \     /  \
  40  50  70  20
```

如果你選擇 30 那 Heap 會變成這樣
```
       30
     /    \
    100     10 
   / \     /  \
  40  50  70  20
```

很明顯的，這不是一個 Min Heap\
雖然我們提到過，同一階層的節點之間，並沒有絕對的大小之分\
儘管如此，在更新的時候你 **依然要選擇最大/最小的節點** 來更新\
確保後續的節點也是符合 Heap 的規則

### Index Calculation
```
       0
     /   \
    1     2
   / \   /
  3   4 5   
```
透過上圖你可以很輕易的推導出，Parent, Left, Right 的關係
+ `Parent` = int(i / 2)
+ `Left`   = 2 * i + 1
+ `Right`  = 2 * i + 2

# [LeetCode 3066. Minimum Operations to Exceed Threshold Value II](https://leetcode.com/problems/minimum-operations-to-exceed-threshold-value-ii/description/)
題目本身相當單純，請你計算總共需要多少的步驟，才能讓陣列中的數值都大於等於 `threshold`\
而每一次的操作都要從陣列裡面取出 `最大` 與 `次大` 的數值，然後將他們計算後放回陣列

很明顯使用 Priority Queue 是一個明顯的選擇\
只不過當你完成之後會發現 TLE 的問題\
即使測資的大小是 $2 * 10^5$，但是因為你需要重複的取出 寫入\
Priority Queue 的效能就會變得很差\
所以使用 [Heap](#heap) 才是正確的選擇
