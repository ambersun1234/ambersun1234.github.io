---
title: 網頁程式設計三兩事 - 不一樣的驗證思維 JWT(JSON Web Token)
date: 2023-03-08
description: JWT 作為近年來相當流行的驗證方式，本文將會介紹 JWT 的基本概念以及其原理，並且會介紹如何使用 JWT 來進行驗證
categories: [website]
tags: [jwt, session, jws, jwe, jwk, golang, oauth, realm, cookie, httponly cookie, authorization]
math: true
---

# Authorization
開發 API 的過程當中，我們提供了很多功能，其中可能包含較為隱私的功能(比如說，修改密碼，查詢個人資料等等的)\
這個時候，你不會希望別人隨便修改你的密碼對吧？\
所以就必須要驗證你的身份

現實生活中驗證身份的方式不外乎就是查看你的證件，要求輸入密碼 ... etc.\
本篇文章將會帶你了解不一樣的驗證方法 - JWT

# Session Authorization
傳統上，要驗證一個人的身份，我們可能會這麼做
1. 要求使用者輸入帳號密碼
2. 將資料送到伺服器中做檢查
3. 確認無誤後，在伺服器上儲存使用者狀態
4. 伺服器回傳一的特殊識別字串，讓你在每一次 request 都帶著方便驗證

![](https://miro.medium.com/v2/resize:fit:640/format:webp/1*KdL8ioxUiLvxSMT5JpJwIA.png)
> ref: [[筆記] HTTP Cookies 和 Session 使用](https://medium.com/%E9%BA%A5%E5%85%8B%E7%9A%84%E5%8D%8A%E8%B7%AF%E5%87%BA%E5%AE%B6%E7%AD%86%E8%A8%98/%E7%AD%86%E8%A8%98-http-cookie-%E5%92%8C-session-%E4%BD%BF%E7%94%A8-19bc740e49b5)

上述的作法是利用了所謂的 session\
當你驗證完成之後，下一次伺服器就會認得你，`哦！ 你已經登入過了！ 可以放行` 這樣

你不難免會好奇，這樣做安全嗎？\
理論上，伺服器除非有漏洞，不然其他人是無法看到這些資訊的

# OAuth 2.0 Framework
OAuth 2.0 定義於 [RFC 6749](https://www.rfc-editor.org/rfc/rfc6749)\
傳統上的 client server 架構下，身份認證會使用 user 的 credential\
當這個情況衍生至第三方也需要存取 credential 的時候，事情會變得稍微複雜\
你理所當然不會希望第三方擁有你的 credential 對吧\
所以 OAuth 的標準立志於解決這種狀況

取而代之的是，OAuth 引入了 access token 的概念\
token 包含了
1. **可以存取** 的範圍(e.g. 你的電話號碼，住址 ... etc.)
2. token 的有效期限

OAuth 人物簡介
1. Resource Owner :arrow_right: user(i.e. 你)
2. Client :arrow_right: 欲取得你的授權拿資料的 application
3. Authorization Server :arrow_right: 驗證身份，並生成授權訪問 token 給 client
4. Resource Server :arrow_right: 儲存用戶機密資料的伺服器, client 必須帶著 token 才能存取

整個 OAuth 的 flow 大致如下
![](https://assets.digitalocean.com/articles/oauth/abstract_flow.png)
> ref: [An Introduction to OAuth 2](https://www.digitalocean.com/community/tutorials/an-introduction-to-oauth-2)

可以看到，client 先從 resource owner 這裡取得 **授權**\
通常在這個步驟就會明確的指定可以存取的範圍\
得到使用者的同意之後就會帶著 grant 向 authorization server 進行存取授權\
拿到 token 之後就可以帶著去 resource server 拿資料了

## Authorization Grant Type
Authorization grant 是一種 credential, 代表 resource owner 核可的授權\
與上面講的傳統 client server 的 credential 不同\
這裡的 credential 不會包含任何密碼什麼的，也就不會有任何洩漏機密資訊的風險

### Authorization Code
![](https://developers.google.com/static/identity/protocols/oauth2/images/examples/scope-authorization.png?hl=zh-tw)
> ref: [OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect?hl=zh-tw)

藉由將使用者導向 authorization server 的一種方法\
當操作完成之後，你的 client 端會拿到一串 authorization code\
你就可以使用這個 token 對 resource server 進行一系列的存取操作\
上圖的 [Google OAuth 2.0 API](https://developers.google.com/identity/protocols/oauth2?hl=zh-tw) 就是一個很好的例子

### Implicit
***已經不推薦使用了***

這個方法，client 會直接取得 access token\
而且不會經過任何驗證

### Resource Owner Password Credentials
***已經不推薦使用了***

![](/assets/img/posts/oauth1.png)

顧名思義，使用 resource owner 的 credential(i.e. user id and password)\
但它並不是把你的 credential 儲存起來\
而是拿你的 password 跟 authorization server 換一個 access token

> 不推薦的原因是因為 OAuth Framework 是基於第三方存取而考量的\
> 當然如果要你直接把密碼給第三方做驗證是我也不想

> 實務上，自己的網頁前後端用這種方法是 ok 的\
> spec 裡面有提到，除非 resource owner 跟 client 之間高度信任，否則不要使用這個方法

### Client Credentials
![](/assets/img/posts/oauth2.png)

長的跟 [Resource Owner Password Credentials](#resource-owner-password-credentials) 很像\
但不同的是，它 **不需要** user 的 credential

# JWT(JSON Web Token)
JWT 定義於 [RFC 7519](https://www.rfc-editor.org/rfc/rfc7519)\
他是一種 `用以描述主體資訊的格式`，且特別方便用於 **對於空白很要求的環境** (e.g. http)\
我們稱這種 `描述主體的資訊` 為 **claim**, 他是由 key/value pair 所組成

> claim 裡面的 key/value pair, key 必須要是 unique 的\
> 如果有出現重複的 key, 他要馬解析失敗，不然就是取最後一個 key 的值

JWT 有兩種主要實作方式，[JWS](#jwsjson-web-signature) 與 [JWE](#jwejson-web-encryption)

## JWS(JSON Web Signature)
JWS 定義於 [RFC 7515](https://www.rfc-editor.org/rfc/rfc7515)

JWS 是使用數位簽章(digital signature)或者 Message Authenticate Codes(MACs) 進行驗證的

> 兩者的不同在於，MACs 不能證明訊息來源的合法性\
> 因為如果有別人知曉了你們之間的 shared key, 它也可以造出一樣的 MACs, 但來源是不可靠的\
> 可參考 [message authentication code (MAC)](https://www.techtarget.com/searchsecurity/definition/message-authentication-code-MAC)

![](https://www.miniorange.com/blog/assets/2023/jwt-structure.webp)
> ref: [What is JWT (JSON Web Token)? How does JWT Authentication work?](https://blog.miniorange.com/what-is-jwt-json-web-token-how-does-jwt-authentication-work/)

整個 JWS 由三個部份構成，並以 `.`(dot) 分開，且每一個部份都由 base64 做 url encode
1. Header
    + `{"typ":"JWT","alg":"HS256"}`
2. Claim payload
    + `{"iss":"joe","exp":1300819380,"http://example.com/is_root":true}`
3. Signature
    + 計算方式: `sha256(base64(header) + "." + base64(payload), secret)`

> 注意到 encode,encrypt 與 hash 的差別，前兩者可以被解碼/解密，後者不能\
> sha256 是一種 hash 的演算法

```shell
$ echo -n '{"typ":"JWT","alg":"HS256"}' | basenc --base64url
eyJ0eXAiOiJKV1QiLA0KICJhbGciOiJIUzI1NiJ9

$ echo -n '{"iss":"joe","exp":1300819380,"http://example.com/is_root":true}' | basenc --baseurl
eyJpc3MiOiJqb2UiLA0KICJleHAiOjEzMDA4MTkzODAsDQogImh0dHA6Ly9leGFtcGxlLmNvbS9pc19yb290Ijp0cnVlfQ
```

> 注意到不要用 base64 去做 encode\
> 因為 base64 跟 base64url 兩個 encode 出來的東西不一樣\
> 可參考 [String based data encoding: Base64 vs Base64url](https://stackoverflow.com/questions/55389211/string-based-data-encoding-base64-vs-base64url) 以及 [How to encode and decode data in base64 and base64URL by using unix commands?](https://stackoverflow.com/questions/58957358/how-to-encode-and-decode-data-in-base64-and-base64url-by-using-unix-commands)

所以最終的 token 會長這樣
```
eyJ0eXAiOiJKV1QiLA0KICJhbGciOiJIUzI1NiJ9
.
eyJpc3MiOiJqb2UiLA0KICJleHAiOjEzMDA4MTkzODAsDQogImh0dHA6Ly9leGFt
cGxlLmNvbS9pc19yb290Ijp0cnVlfQ
.
dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
```

## JWE(JSON Web Encryption)
JWE 定義於 [RFC 7516](https://www.rfc-editor.org/rfc/rfc7516)\
與 JWS 不同的是，JWE 會將 payload 進行 **加密**

JWE 由五個部份構成，並以 `.`(dot) 分開，且每一個部份都由 base64 做 url encode
1. JWE protected header(`{"alg":"RSA-OAEP","enc":"A256GCM"}`)
2. Random Content Encryption Key(CEK)
3. Random JWE Initialization Vector(IV)
4. JWE Cipher text
5. JWE Authentication Tag(CEK + IV + Additional Authenticated Data)

token 最終結果會長這樣
```
eyJhbGciOiJSU0EtT0FFUCIsImVuYyI6IkEyNTZHQ00ifQ
.
OKOawDo13gRp2ojaHV7LFpZcgV7T6DVZKTyKOMTYUmKoTCVJRgckCL9kiMT03JGe
ipsEdY3mx_etLbbWSrFr05kLzcSr4qKAq7YN7e9jwQRb23nfa6c9d-StnImGyFDb
Sv04uVuxIp5Zms1gNxKKK2Da14B8S4rzVRltdYwam_lDp5XnZAYpQdb76FdIKLaV
mqgfwX7XWRxv2322i-vDxRfqNzo_tETKzpVLzfiwQyeyPGLBIO56YJ7eObdv0je8
1860ppamavo35UgoRdbYaBcoh9QcfylQr66oc6vFWXRcZ_ZT2LawVCWTIy3brGPi
6UklfCpIMfIjf7iGdXKHzg
.
48V1_ALb6US04U3b
.
5eym8TW_c8SuK0ltJ3rpYIzOeDQz7TALvtu6UG9oMo4vpzs9tX_EFShS8iB7j6ji
SdiwkIr3ajwQzaBtQD_A
.
XFBoMYUZodetZdvTiFvSkQ
```

### Header of JWE
+ `enc`
    + enc header 用於指定加密內容的方法，通常選擇 **對稱式加密**(e.g. [AES-256-CBC](https://en.wikipedia.org/wiki/Advanced_Encryption_Standard))
+ `alg`
    + alg header 用於指定加密 CEK 的方法，為了確保安全性，通常選擇 **非對稱式加密法**(e.g. [RSAES OAEP](https://en.wikipedia.org/wiki/Optimal_asymmetric_encryption_padding))

### How does Encryption work
JWE 最特別的地方就是它會將 payload 加密成 cipher text\
那麼具體來說他的加密方式如下

+ 透過對稱式加密(使用 CEK 當作加密鑰匙)加密 payload
+ 透過非對稱式加密 加密 CEK 鑰匙

> 為什麼不用非對稱式加密 payload?\
> 那是因為 asymmetric encryption 通常有長度上限\
> 大約只能 $floor(n/8) - 2 * ceil(h/8) - 2$\
> ref: [What is the limit to the amount of data that can be encrypted with RSA?](https://stackoverflow.com/questions/5583379/what-is-the-limit-to-the-amount-of-data-that-can-be-encrypted-with-rsa)

### Decryption
驗證完成之後，在使用 recipient 自己的 private key 進行解密\
就可以讀取內容了

<hr>

## JWK(JSON Web Key)
JWK 定義於 [RFC 7517](https://www.rfc-editor.org/rfc/rfc7517)\
是有關於 cryptographic key 的 json 格式定義

```
{
    "kty":"EC",
    "crv":"P-256",
    "x":"f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU",
    "y":"x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0",
    "kid":"1"
}
```

+ `kty` :arrow_right: 金鑰類型(key type), 可以是 `RSA` 或者是 `EC`(Elliptic Curve), case-sensitive
+ `use` :arrow_right: 金鑰用途, 可以是 `sig`(signature) 或是 `enc`(encryption), case-sensitive
+ `alg` :arrow_right: 金鑰演算法
+ `kid` :arrow_right: 金鑰唯一識別符(key id), 用來找特定的 public key

其他欄位是根據不同演算法而會有的類別，上述例子中的 `x`(公鑰), `crv`(公鑰), `y`(私鑰) 是 `Elliptic Curve` 才會出現的參數
> ref: [RFC 7518 §6.2](https://www.rfc-editor.org/rfc/rfc7518#page-28)

而 jwks 就是一堆的 jwk 所組成的 json 檔案
```
{"keys":
       [
         {"kty":"EC",
          "crv":"P-256",
          "x":"MKBCTNIcKUSDii11ySs3526iDZ8AiTo7Tu6KPAqv7D4",
          "y":"4Etl6SRW2YiLUrN5vfvVHuhp7x8PxltmWWlbbM4IFyM",
          "use":"enc",
          "kid":"1"},

         {"kty":"RSA",
          "n": "0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx
                4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMs
                tn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2
                QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbI
                SD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqb
                w0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw",
          "e":"AQAB",
          "alg":"RS256",
          "kid":"2011-04-29"}
       ]
     }
```

## JWA(JSON Web Algorithms)
加密演算法定義，可參考 [RFC 7518](https://www.rfc-editor.org/rfc/rfc7518)

<hr>

## Distinguish JWE from JWS
有以下幾點可以分辨

1. dot 數量不一樣(2 個以及 4 個，分別對應 JWS 與 JWE)
2. `alg` header(JWS 為 none, JWE 則有值)
3. `enc` header 存在與否(JWS 不存在，JWE 存在)

![](https://trustfoundry.net/wp-content/uploads/2017/12/jws-vs-jwe-1024x336.jpg)
> ref: [JWT Hacking 101](https://trustfoundry.net/2017/12/08/jwt-hacking-101/)

## Nested JWT
nested JWT 也是被支援的，只是根據 RFC 文件中所述，他是不建議這樣寫的\
header 的部份需要帶入 `cty` 值為 `JWT`(建議大寫，用以兼容 legacy system)

## Unsecure JWT
JWT 也支援不帶 signature 的寫法，在 header 當中帶入一個參數 `alg` 並將其設置為 `none` 即可\
不帶 signature 也就表示最後出來的 JWT token string 只會有兩個部份，看以下例子

```shell
# header: {"alg":"none"}
$ echo -n '{"alg":"none"}' | basenc --base64url
eyJhbGciOiJub25lIn0
```

> 注意到不要用 base64 去做 encode\
> 因為 base64 跟 base64url 兩個 encode 出來的東西不一樣\
> 可參考 [String based data encoding: Base64 vs Base64url](https://stackoverflow.com/questions/55389211/string-based-data-encoding-base64-vs-base64url) 以及 [How to encode and decode data in base64 and base64URL by using unix commands?](https://stackoverflow.com/questions/58957358/how-to-encode-and-decode-data-in-base64-and-base64url-by-using-unix-commands)

它最後會長成類似這樣
```
eyJhbGciOiJub25lIn0
.
eyJpc3MiOiJqb2UiLA0KICJleHAiOjEzMDA4MTkzODAsDQogImh0dHA6Ly9leGFt
cGxlLmNvbS9pc19yb290Ijp0cnVlfQ
.
```

可以看到第二個點(dot)後面並沒有任何的 signature

# Verifying a JWT
那我要怎麼驗證 JWT 的來源是否合法？

前面 [JWK(JSON Web Key)](#jwkjson-web-key) 我們有提到\
你可以 either 使用 symmetric 或 asymmetric key 當作 JWT signing key

## Symmetric Key
既然你的簽章是用一把 "對稱式" 金鑰下去算的\
client 要驗證的唯一方式 是不是用金鑰下去算算看？\
如果用 header + payload 算出來的結果跟你傳過來的 signature 一樣\
就代表這個 token 來源被驗證了！  嗎

記不記得在前面 [JWS(JSON Web Signature)](#jwsjson-web-signature) 有提到\
簽章有兩種方式, digital signature 跟 Message Authentication Codes(MACs)

> 數位簽章(digital signature) 可以驗證 1. 資料完整性 2. 來源合法性\
> Message Authentication Codes(MACs) 可以驗證 1. 資料完整性\
> 其中 MACs 是沒辦法驗證來源的

道理倒也淺顯易懂\
如果第三方取得你的 signing key, 我是不是也能偽造簽章了？

也因此，對稱式的金鑰通常不會驗，也沒辦法驗

## Asymmetric Key
非對稱式金鑰事情就變得有趣了

> 請注意，這跟 [JWE(JSON Web Encryption)](#jwejson-web-encryption) 不一樣！\
> 我們 ***並沒有*** 加密 header 以及 payload\
> 這裡單純講 ***簽章(signature)*** 使用 asymmetric encryption

### How does Asymmetric Encryption Work
稍微複習一下，非對稱式加密的運作原理\
context: A 與 B 要互相傳訊息
1. A 使用 `B 的 public key 加密 payload`, 並使用 `A 的 private key 簽名(sign)`
2. B 收到訊息，使用 `A 的 public key 驗證`, 並使用 `B 的 private key 解密`

<hr>

client 可以透過取得 public key 的方式驗證\
那這個 public key 在哪呢？\
根據 [OpenID Connect Discovery 1.0 incorporating errata set 1](https://openid.net/specs/openid-connect-discovery-1_0.html) public key 是必須儲存在每一台伺服器上的\
你必須要先發起一個 get request 到 `/.well-known/openid-configuration`\
伺服器要回一個 json 檔，大概長這樣
```
{
   "issuer":
     "https://server.example.com",
   "authorization_endpoint":
     "https://server.example.com/connect/authorize",
   "token_endpoint":
     "https://server.example.com/connect/token",
   "token_endpoint_auth_methods_supported":
     ["client_secret_basic", "private_key_jwt"],
   "token_endpoint_auth_signing_alg_values_supported":
     ["RS256", "ES256"],
   "userinfo_endpoint":
     "https://server.example.com/connect/userinfo",
   "check_session_iframe":
     "https://server.example.com/connect/check_session",
   "end_session_endpoint":
     "https://server.example.com/connect/end_session",
   "jwks_uri":
     "https://server.example.com/jwks.json",                 <---

    ...
}
```
其中 public key 的位置就是 `jwks_uri`
> 或者是 `https://{yourDomain}/.well-known/jwks.json`

jwks.json 裡面可能包含了多組 key, 其中每一組 key 的格式可以參考 [JWK(JSON Web Key)](#jwkjson-web-key)\
拿到 public key 之後，之後的操作就相對簡單了

> jwks 的運作流程，推薦可以去這篇文章 [[OpenID] 使用 RS256 與 JWKS 驗證 JWT token 有效性](https://fullstackladder.dev/blog/2023/01/28/openid-validate-token-with-rs256-and-jwks/)

## Server Side Verification
伺服器端的驗證則是\
signature 的計算是使用存在 server 上的 signing key 加上前面 header 以及 payload 雜湊出來的\
要驗證，就是再算一次，算出新的 new signature 與送過來的 signature 進行對比\
如果兩個一樣，就代表資料沒有被竄改過

# Is JWT Safe?
看了以上兩種 JWT 的實作，你應該有發現\
[JWS](#jwsjson-web-signature) 並沒有針對 payload 進行加密，等同於他是裸奔在網路上的\
那這樣是不是就等於 JWS 其實不怎麼安全？

如果真的有傳送機密訊息的需求，使用 [JWE](#jwejson-web-encryption) 是最好的選擇\
不過普遍來說，我們認為 http 的 TLS 已經足夠應付大多數的場景了

> 有關 TLS 的介紹可以參考 [重新認識網路 - 從基礎開始 \| Shawn Hsu](../../network/network-basics#ssl---secure-sockets-layertls)

既然 JWS 沒有進行加密\
一般來說是不建議在上面塞入任何敏感資訊\
以我自己來說，我通常只會帶個 user id 之類洩漏也不會怎麼樣的資料\
畢竟你可以直接 decode 這串 `eyJ1c2VySUQiOjF9`
```shell
$ echo -n 'eyJ1c2VySUQiOjF9' | basenc --base64url -d
{"userID":1}
```

# Why JWT Popular than Session Authorization
session 逐漸式微的原因，有幾個面向可以討論

主要的原因是，現如今系統規模都不單只是一台伺服器的架構，你可能會跑 micro service 對吧？\
那你要怎麼同步 session 就是一個大問題了\
你的 token 可能在 A server 上，但是下一次 request 過來可能是 B server 處理，這時候你的 session 就不見了

> 這時候你就需要 **sticky session** 了

二來是，根據 [RFC 1945](https://www.rfc-editor.org/rfc/rfc1945), HTTP 1.0 的文件就已經開宗明義表明，HTTP 是屬於無狀態的 protocol

>  The Hypertext Transfer Protocol (HTTP) is an application-level\
>  protocol with the lightness and speed necessary for distributed,\
>  collaborative, hypermedia information systems. It is a generic,\
>  stateless, object-oriented protocol which can be used for many tasks,\
>  such as name servers and distributed object management systems,\
>  through extension of its request methods (commands). A feature of\
>  HTTP is the typing of data representation, allowing systems to be\
>  built independently of the data being transferred.

> 有關更多 HTTP 相關探討，可以參考 [重新認識網路 - HTTP1 與他的小夥伴們 \| Shawn Hsu](../../network/network-http1)

所以總結起來就是兩點
+ 多台伺服器下，session 如何同步
+ 為了遵守 HTTP 無狀態的規範

那你說，session 就真的沒用了嗎？\
client 必須在每一次的 request 都帶著 token 進行請求\
萬一我伺服器想要主動踢掉他的訪問權限怎麼辦？ 比方說我要進行系統升級之類的\
因為狀態完全由 client 管理，我 server 根本不知道目前誰可以存取，自然也就不知道怎麼設定黑名單了

難道我只能眼睜睜看著他的 token 到期才有辦法嗎？\
所以現今的實作依然有保留 session 的 **概念**(注意是概念而已)\
也就是說我伺服器上面同時紀錄著當前登入的人，那這樣我就可以隨時把他的權限移除(server side)\
下次 client 再跑來請求的時候，當我發現 server 上面已經把它 revoke 它就無法存取\
也就達到主動踢人的方法了

> 這部份可以考慮用 Redis 實作

# HTTP Authorization Header
前面講了這麼多的 JWT token, 實際使用的時候\
它應該放在哪裡呢

HTTP 的 request header 中提供了一個 `Authorization header` 讓你可以放所謂的 credentials\
有了這個，你就可以存取受到保護的資源了

阿要記得 如果你是跨網域請求\
你的後端必須額外設定一個 request header\
`Access-Control-Allow-Credentials` 設定為 `true`

> 有關更多跨網域相關的請求，可以參考 [網頁程式設計三兩事 - 萬惡的 Same Origin 與 CORS \| Shawn Hsu](../../website/website-cors)

## Authorization Header Schemes
### Basic Scheme
Basic scheme 定義於 [RFC 7617](https://www.rfc-editor.org/rfc/rfc7617)

basic scheme 帶的資料會是 userid 以及 password(兩者都使用 base64 做 url encode)\
這個 scheme 由於是 **plain text** 的，因此被視為是不安全的，除非！ 你的 HTTP 走 TLS

<hr>

那它整體驗證流程是要怎麼用？
1. 如果 server 想要 client 進行驗證，那麼它會發一個 challenge 給 client(順便在帶一個 http 401)
    ```
    HTTP/1.1 401 Unauthorized
    Date: Mon, 04 Feb 2014 16:50:53 GMT
    WWW-Authenticate: Basic realm="WallyWorld"
    ```
2. client 必須要傳 user id 跟 password 回去 server 端進行驗證
    + user id 與 password 中間以 `:`(冒號隔開)
    ```
    Authorization: Basic dGVzdDoxMjPCow==
    ```

    + 其中 `dGVzdDoxMjPCow==` 是 user id 與 password 的組合
    ```shell
    $ echo -n 'dGVzdDoxMjPCow==' | basenc --base64url -d
    test:123£
    ```

就沒了

> 有關 realm，可參考 [realm](#realm)

### Bearer Scheme
Bearer scheme 定義於 [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750)\
不同於以往 直接使用使用者本身的 credential，Bearer scheme 是 **使用一個字串代表允許授權訪問**\
而這個模式正是 [OAuth 2.0 Framework](#oauth-20-framework)

bearer scheme 使用的方式就相對簡單
```
Authorization: Bearer eyJ0eXAiOiJKV1QiLA0KICJhbGciOiJIUzI1NiJ9.
                      eyJpc3MiOiJqb2UiLA0KICJleHAiOjEzMDA4MTkzODAsDQog
                      Imh0dHA6Ly9leGFtcGxlLmNvbS9pc19yb290Ijp0cnVlfQ.
                      dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
```

其中後面那串就是 JWT token

<hr>

跟 [Basic Scheme](#basic-scheme) 一樣，server 一樣有 challenge, 一樣有 [realm](#realm)\
不過我個人的經驗上是不常看到就是

# JWT in Cookie?
這聽起來很反人類，至少對我而言是如此

cookie 本身就是一個存放在 client 端的資料\
為何 backend 能夠存取？\
事實上每一次的 request 都會帶上 cookie，這是因為 browser 會自動幫你帶上去\
簡單暴力的 `Cookie` header

因此，後端是可以存取 cookie 的\
只不過要注意的是，cookie 本身是可以被 client 端修改的\
所以安全性沒有那麼高

<hr>

但為什麼要把 JWT token 放在 cookie 裡面呢？\
有好好的 Authorization header 不用是為什麼?\
安全性嗎？ 對，就是安全性

cookie 有一個特性，就是 `httpOnly`\
這個特性可以讓 cookie 只能被 server 端存取，而無法被 client 端存取\
也就是說，惡意的 javascript 不能夠存取你的 cookie 拿到你的 token 自然也就無法存取你的資源

> 也可以搭配 `secure` 這個特性，讓 cookie 只能在 https 下使用

所以這就是為什麼有些人會選擇把 JWT token 放在 cookie 裡面\
但終究是不同的選擇，要看你的需求

# realm
realm 指的是一個區域，要進行身份驗證的區域\
啥意思呢？\
一個網站之中，總有那麼幾個頁面是需要登入才能存取的吧？\
而 realm 指的就是那些受到保護的區域

上述的 `WallyWorld` 是該區域的一個識別字串\
只要你存取的頁面是在這個區域裡面，就通通都需要進行驗證\
相同的 realm 代表，他們是屬於相同的驗證範圍

那麼能不能重複使用所謂的 credential 呢？\
事實上是可以的，**只要在相同 URI 底下 都可以重複使用 credential**\
什麼樣叫做相同 URI? 當然指的並不是網址完全一樣\
以下這幾個 **prefix 相同的 URI** 被視為是可以重複使用 credential 的地方
```
http://example.com/docs/
http://example.com/docs/test.doc
http://example.com/docs/?page=1
```

要注意的是，URI 本身可能會包含在多個 realm 底下(需要多個 authentication)\
至於要用哪個 credential，就我目前看到的，並未特別定義

# JWT Token in Golang
最後的最後，小小實戰一下

```go
import (
    "time"

    "github.com/golang-jwt/jwt"
)

type JWTAuth struct {
    jwt.StandardClaims

    UserID uint
}

func GenerateJWTToken(userID uint, email string) (string, error) {
    token := jwt.NewWithClaims(jwt.SigningMethodHS512, JWTAuth{
        StandardClaims: jwt.StandardClaims{
            Subject:   email,
            ExpiresAt: time.Now().Add(constant.JWTExpire).Unix(),
        },
        UserID: userID,
    })

    tokenStr, err := token.SignedString(constant.JWTKey)
    if err != nil {
        return "", err
    }

    return tokenStr, nil
}
```
生成 token 的方式，使用 [github.com/golang-jwt/jwt](https://github.com/golang-jwt/jwt) 產生\
其中你的 payload 可以塞任何你想塞的東西\
standard claim 裡面有 subject 以及 expire time

這裡額外宣告了一個 structure, 繼承自 `jwt.StandardClaims`\
如此一來你就可以在這塞入任何 payload

不過切記，這裡的東西可以簡單的被 base64 url decode\
機密資料不要放入

準備好資料之後，要進行簽名\
`constant.JWTKey` 是一串 byte array, 它可以是 symmetric key 或者是 asymmetric key

> symmetric key 沒有什麼特定格式，它可以是隨便的字串(e.g. 'abc')\
> 相反的 asymmetric key 就必須要用 openssl 或者是 ssh-keygen 之類的應該也行?

```go
import (
    "time"
    "fmt"

    "github.com/golang-jwt/jwt"
)

type JWTAuth struct {
    jwt.StandardClaims

    UserID uint
}

func ParseJWTToken(tokenString string) (*jwt.Token, *JWTAuth, error) {
    var claims JWTAuth
    token, err := jwt.ParseWithClaims(tokenString, &claims, func(token *jwt.Token) (interface{}, error) {
    if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, errors.New(fmt.Sprintf("unexpected signing method: %v", token.Header["alg"]))
        }
        return constant.JWTKey, nil
    })

    if err != nil {
        return nil, nil, err
    }

    return token, &claims, nil
}
```

最後當然就是將 JWT 套到你的 application 上面
```go
import (
    "net/http"

    "github.com/gin-gonic/gin"
    "github.com/golang-jwt/jwt"
)

func AuthMiddleware() func(ctx *gin.Context) {
    return func(ctx *gin.Context) {
        tokenString := ctx.Request.Header.Get("Authorization")
        if tokenString == "" {
            ctx.AbortWithStatusJSON(http.StatusUnauthorized, nil)
            return
        }

        token, claims, err := shared.ParseJWTToken(tokenString)
        if err != nil {
            if err.(*jwt.ValidationError).Errors&jwt.ValidationErrorExpired != 0 {
                ctx.AbortWithStatusJSON(http.StatusUnauthorized, nil)
            } else {
                ctx.AbortWithStatusJSON(http.StatusInternalServerError, nil)
            }
            return
        }

        if !token.Valid {
            ctx.AbortWithStatusJSON(http.StatusInternalServerError, nil)
            return
        }

        ctx.Set("userID", claims.UserID)
        ctx.Set("email", claims.Subject)

        ctx.Next()
    }
}
```

採用 middleware 的方式，針對每個需要進行 authorize 的資料進行保護\
這段就普普通通\
驗證 token 是否合法，並且取出我們塞的 payload 就大功告成了

# References
+ [是誰在敲打我窗？什麼是 JWT ？](https://5xruby.tw/posts/what-is-jwt)
+ [Understanding JSON Web Encryption (JWE)](https://www.scottbrady91.com/jose/json-web-encryption)
+ [Where does jwt.io get the public key from JWT token?](https://stackoverflow.com/questions/64297228/where-does-jwt-io-get-the-public-key-from-jwt-token)
+ [JWT verify using public key](https://metamug.com/article/security/jwt-verify-using-public-key.html)
+ [JSON Web Key Sets](https://auth0.com/docs/secure/tokens/json-web-tokens/json-web-key-sets)
+ [Encrypt and Decrypt sensitive data with JSON Web Encryption(JWE)](https://medium.com/aeturnuminc/encrypt-and-decrypt-sensitive-data-with-jwe-70421722f7e5)
+ [JWT Private / Public Key Confusion](https://stackoverflow.com/questions/60538047/jwt-private-public-key-confusion)
+ [Authorization](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Authorization)
+ [Understanding the purpose of "realm" in Basic WWW Authentication](https://stackoverflow.com/questions/23172137/understanding-the-purpose-of-realm-in-basic-www-authentication)
+ [What is the "realm" in basic authentication](https://stackoverflow.com/questions/12701085/what-is-the-realm-in-basic-authentication)
+ [Difference between the "Resource Owner Password Flow" and the "Client Credentials Flow"](https://stackoverflow.com/questions/22077487/difference-between-the-resource-owner-password-flow-and-the-client-credential)
+ [JWT Keys - Asymmetric and Symmetric](https://stackoverflow.com/questions/32900998/jwt-keys-asymmetric-and-symmetric)
+ [簡介其他 OpenID Connect 協定的內容](https://ithelp.ithome.com.tw/articles/10227389)
+ [使用 HTTP Cookie](https://developer.mozilla.org/zh-TW/docs/Web/HTTP/Cookies)
