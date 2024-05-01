---
title: 從 0 認識 Blockchain - 錢包基礎原理
date: 2024-05-01
description: 本文將從助記詞出發，探討 wordlist, hash 並逐步帶你理解加密貨幣錢包運作的基礎原理
categories: [blockchain]
tags: [blockchain, ethereum, wallet, seed, hash, mnemonic, wordlist, bitcoin, master key, hierarchical deterministic wallet, deterministic wallet]
math: true
---

# Preface
加密貨幣涉及了很多密碼學相關的知識\
其中錢包這裡佔了滿多部份的\
這篇文章會盡量的用簡單的方式來說明\
跟我一起看看吧

# Introduction to Wallet
錢包可以說是加密貨幣中至關重要的一部分\
你的所有虛擬資產將會被儲存在錢包中

錢包的建立是使用數學的方法產生一組密碼學相關的資訊\
比方說你的 `Public Key` 以及 `Private Key`\
之後你就可以用這組資訊跟區塊鏈互動

其實產生的方法還有另外一種是用一組 `master key`\
然後透過 master key 產生無數的 `公私鑰`\
本文將會著重討論此種方式(Deterministic Wallet)

## Wallet Mnemonic
> mnemonic 讀作 nemonic, 第一個 m 不發音

![](https://i.pinimg.com/originals/11/9f/cd/119fcd6f215892ebc952e7befb7ad850.png)
> ref: [https://www.pinterest.com/pin/brave-wallet-backup-mnemonic-page--570549846541363404/](https://www.pinterest.com/pin/brave-wallet-backup-mnemonic-page--570549846541363404/)

在創建新的錢包的時候，[BitCoin](https://bitcoin.org/en/) 或者是 [Ethereum](https://ethereum.org/en/) 都會告訴你需要將 `助記詞` 保管好\
而這個助記詞在錢包中扮演了相當重要的角色

前面提到，deterministic wallet 會產生一組 `master key`, 然後可以透過它產生無數 `公私鑰`\
那麼 master key 就跟 mnemonic(助記詞) 很有關係了

### Mnemonic Wordlist
助記詞你可以看到是由若干個英文單字所組成的\
它本質上還是一串數字，只是為了方便人類辨識、閱讀以及記憶\
所以採用文字的方式紀錄而已

而這個紀錄方式非也像是 [ASCII](https://en.wikipedia.org/wiki/ASCII) 這種編碼而已\
取而代之的是採用一種叫做 `wordlist` 的東西\
想的簡單一點就是一個詞彙字典而已\
比方說 `apple` 是 1, `banana` 是 2 等等

> wordlist 不一定要是英文，你也可以製作其他語言的 wordlist\
> 畢竟那個就只是一個詞彙字典而已

根據 [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) 所描述\
助記詞應該要包含以下特性
1. 要避免相似的詞彙
2. 透過前四個字母就可以確定是哪一個詞彙

參考 [BIP-39 wordlist](https://github.com/bitcoin/bips/blob/master/bip-0039/english.txt)\
考慮以下助記詞，他的編碼過後的數字是多少？
```
bronze barrel chicken
```

> bitcoin 的 wordlist 是 0-based, 所以要 -1

```
bronze  -> 229
barrel  -> 150
chicken -> 331
```

那麼它編碼後的就是 `0x1ca2589e`(十進位轉八進位，自己算算看，懶的話可以用 [Mnemonic Code Converter](https://iancoleman.io/bip39/))

那麼這串數字！ 還不是 master key\
你還必須要再透過 hash function 算個百八十遍才會得到最終的 master key

hash function 要選擇 [PBKFD2](https://zh.wikipedia.org/zh-tw/PBKDF2) 的演算法\
他的重點在於要 **重複 hashing** 以增加安全性(i.e. 金鑰延伸)\
輸入就是
1. 助記詞
2. 密碼(你的錢包的密碼)
3. salt

> 重複多少呢，BitCoin 是 2048 次

<hr>

到這裡你就成功的做出 master key 了\
看了上面的討論，就可以理解為什麼你要保管好 mnemonic 的原因\
拿到 mnemonic 可以復原你的所有公私鑰，然後攻擊者就可以偷你的錢了(劃重點)

## Wallet Seed(master key)
![](https://github.com/bitcoin/bips/raw/master/bip-0032/derivation.png)
> ref: [BIP-32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)

> entropy 是 mnemonic decode 之後的八進位數字\
> HMAC-SHA512 是 PBKFD2 的演算法

有了 master key 之後，上圖你可以看到\
我們就可以產生無數的公私鑰\
而這就是 deterministic wallet(hierarchical deterministic wallet) 的運作方式

只要有一把 master key 就可以管理底下全部的公私鑰\
不論是備份或者是要做 restore 都挺方便的

# Restore Wallet
看到這裡你應該很清楚，使用 [Mnemonic](#wallet-mnemonic) 就可以一鍵還原你的所有錢包\
但我就在想他是怎麼做的

別誤會，我知道只要 mnemonic 就可以復原\
但問題是它怎麼知道你有多少錢包？

還記得先前我們說過你可以創建無數錢包嗎\
所以理論上你就可以復原出無數錢包了\
連包含你沒有產生的錢包理論上都算的出來 這顯然哪裡怪怪的

wallet restore 的時候他是會算出所有錢包的公私鑰沒錯\
只不過它會多一個步驟是檢查他有沒有在鏈上\
所以它才只會回復你自己建立過得錢包而已

# Why Generate Wallet By Cryptography
為什麼你要用一個這麼複雜的方式產生錢包而不是單純的使用隨機數字來產生錢包呢

其中一個原因很明顯跟安全有關\
隨機數字產生錢包，他的密碼安全性是不夠強的\
就跟我們用 ssh key 登入伺服器一樣

另一個我覺的寫得很好的原因是為了去中心化\
如果像傳統銀行一樣使用流水號的方式來產生錢包的話\
先不說安全性，勢必是需要一個 `中心化` 的設施來發行流水號\
而這與 blockchain 的概念背道而馳

# References
+ [【加密貨幣錢包】從 BIP32、BIP39、BIP44 到 Ethereum HD Wallet](https://medium.com/taipei-ethereum-meetup/%E8%99%9B%E6%93%AC%E8%B2%A8%E5%B9%A3%E9%8C%A2%E5%8C%85-%E5%BE%9E-bip32-bip39-bip44-%E5%88%B0-ethereum-hd-%EF%BD%97allet-a40b1c87c1f7)
