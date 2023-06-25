---
title: 設定你的 Remote VS Code Server
date: 2023-06-01
categories: [random]
tags: [vscode, linux, ssh]
math: true
---

# Preface
對於一個無時無刻都想寫 code 的工程師來說\
如果能用手機，平板等等的設備開發，豈不美哉

不過常常受限於終端裝置的效能，抑或著是平台的關係\
導致使用體驗並沒有很好

本篇文章，將會在你的開發電腦上面，設定一個遠端系統\
允許你使用其他終端裝置存取，並享受隨時寫 code 的樂趣\
對於會設定 SSH 相關的人，可以直接跳轉至 [Code Server](#code-server)

# SSH

## Public/Private Key
SSH 仰賴公私鑰的系統進行運作\
金鑰是使用 [非對稱式加密法](https://en.wikipedia.org/wiki/Public-key_cryptography) 生成的\
而它的安全性是基於數學問題所提供的(大質因數分解)，也因此很難被破解\
兩把鑰匙，一個加密，一個解密，是成雙成對的，使用其他把鑰匙是無法解出正確的資訊的\
一般來說，公鑰可以在網路上裸奔沒有問題，但私鑰只能放在你自己身上且完全不能外流

<hr>

生成一把金鑰最簡單的方式是透過以下指令
```shell
$ ssh-keygen -t rsa -b 8192 -C ""
Generating public/private rsa key pair.
Enter file in which to save the key (/home/user/.ssh/id_rsa): 
Enter passphrase (empty for no passphrase): 
Enter same passphrase again: 
Your identification has been saved in /home/user/.ssh/id_rsa
Your public key has been saved in /home/user/.ssh/id_rsa.pub
The key fingerprint is:
SHA256:vWQtmEj7WwgoQe7eGoOJ77jQD2hzg0nigQbdtC8mjK8 
The key's randomart image is:
+---[RSA 8192]----+
|  . .            |
| + o .           |
|. + o .          |
|o+ . + o + .     |
|++= + = S = .    |
|*B+= . o + o     |
|**Bo.   o o      |
|o+o*.    o       |
|Eo+ .   .        |
+----[SHA256]-----+
```

其中

|Argument|Description|
|:--|:--|
|`-t`|非對稱式加密演算法|
|`-b`|金鑰長度|
|`-C`|comment|

> 詳細可以參考 [man ssh-keygen](https://linux.die.net/man/1/ssh-keygen)

生成完畢之後會擁有兩個檔案，預設為
+ `id_rsa` :arrow_right: 私鑰
+ `id_rsa.pub` :arrow_right: 公鑰

<hr>

另一種方式是透過 GPG 生成公鑰\
取得公鑰的方法是
```shell
$ gpg --export-ssh-key xxx
// xxx 可以讀取 Yubikey 取得
$ gpg --card-status
```
詳細可以參考 [GPG 與 YubiKey 的相遇之旅 \| Shawn Hsu](../../random/gpg)

<hr>

公鑰的 **開頭** 內容擁有特定的格式，如以下所示

|Valid public key format|
|:--|:--|:--|
|ssh-rsa|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|
|ecdsa-sha2-nistp521|ssh-ed25519|sk-ecdsa-sha2-nistp256@openssh.com|
|sk-ssh-ed25519@openssh.com|||

## SSH Server
安裝 openssh server
```shell
$ sudo apt install openssh-server -y
```

更改 ssh 設定檔
```shell
$ sudo vim /etc/ssh/sshd_config
```
可以根據你的需要打開不同的設定\
為了提高安全性，我只允許使用公鑰的登入方式並且將密碼登入停用
```
Port 22
PermitRootLogin no
PubkeyAuthentication yes
PasswordAuthentication no
```

設定檔更改完成之後\
重啟 ssh server
```shell
$ sudo /etc/init.d/ssh restart
```

<hr>

為了進一部增強安全性，特別是你的電腦可以對外的情況下\
你可以設定允許連線的白名單

```shell
$ sudo vim /etc/hosts.allow
```
並填入白名單
```
sshd: 192.168.*.*
```
> 我只允許我內網的機器能夠連線

## Upload Public Key to SSH Server
### Manual Upload
由於我們設定 ssh 的方式是不允許任何密碼登入\
也因此不能使用 [ssh-copy-id](#ssh-copy-id) 的方式

如果你能夠直接存取伺服器，可以試試手動上傳金鑰\
如果不行，那麼你可以先暫時打開密碼登入，並且使用 [ssh-copy-id](#ssh-copy-id) 的方式先上傳，完成之後在關閉密碼登入

將所有公鑰的內容複製並貼上至 `~/.ssh/authorized_keys` 就可以了
```shell
$ cat ~/.ssh/id_rsa.pub
$ touch ~/.ssh/authorized_keys
// paste the public content
$ chmod 700 ~/.ssh
$ chmod 600 ~/.ssh/authorized_keys
```

### ssh-copy-id
另一個方法就相對比較簡單，透過 `ssh-copy-id` 的指令上傳公鑰
```shell
$ ssh-copy-id -i ~/.ssh/id_rsa.pub -p port user@host
```

這個方式是使用密碼進行驗證\
但即使你成功上傳了金鑰，沒有妥當的設定後續的登入也依然會使用密碼，詳細可以參考 [SSH Config](#ssh-config)

> port, user, host 要根據你的 SSH 伺服器位置而定

## SSH Config
每次都要打那麼一長串的指令實屬麻煩\
SSH 可以透過撰寫 config 的方式簡化

建立一個 config 檔並輸入以下資訊(`touch ~/.ssh/config`)
```
Host server
    HostName 192.168.1.1
    IdentitiesOnly yes
    IdentityFile ~/.ssh/id_rsa
    Port 22
    User user
```

把所有連線資訊一併寫入設定檔，像是主機位置、port 以及使用者名稱\
最最重要的是，使用金鑰驗證的方式
+ `IdentitiesOnly` :arrow_right: 要不要使用指定的私鑰
+ `IdentityFile` :arrow_right: 私鑰路徑(因為你可能有多個私鑰)

接著你就可以將
```shell
$ ssh user@192.168.1.1 -p 22
```
簡化成
```shell
$ ssh server
```

## SSH Tunnel
Tunnel 指的是，將網路上的兩個端點以某種方式連起來，形成一個隧道的方式\
SSH Tunnel 就是讓 SSH 建立這個隧道

![](https://johnliu55.tw/ssh-tunnel/images/local_scenario1_problem.png)
> ref: [SSH Tunneling (Port Forwarding) 詳解](https://johnliu55.tw/ssh-tunnel.html)

上圖可以看到，你沒有辦法直接連線 8080, 因為它沒有對外\
因此透過 SSH Tunnel 的方式，我們可以稍微繞個路連接上我們需要的服務，就像下圖所示

![](https://johnliu55.tw/ssh-tunnel/images/local_scenario1_solved.png)
> ref: [SSH Tunneling (Port Forwarding) 詳解](https://johnliu55.tw/ssh-tunnel.html)

僅須一個簡單的指令，就可以建立 SSH Tunnel
```shell
$ ssh -L 8080:127.0.0.1:8080 server
```

> 詳細的 Tunnel 方式，可以參考 [SSH Tunneling (Port Forwarding) 詳解](https://johnliu55.tw/ssh-tunnel.html)

# fail2ban
如果你的電腦是直接對外的，那麼最好要安裝 [fail2ban](https://www.fail2ban.org/wiki/index.php/Main_Page)\
它可以 ban 掉登入失敗的機器

```shell
// install
$ sudo apt install fail2ban

// enable on boot
$ sudo systemctl enable fail2ban
```

新增規則設定檔(`$ sudo touch /etc/fail2ban/jail.local`)，並填入以下
```
[sshd]
enabled  = true
maxretry = 2
findtime = 600
bantime  = 3600
```
重啟即可
```shell
$ sudo service fail2ban restart
```

# Website Code Server
我們會使用 [code server](https://github.com/coder/code-server) 作為遠端的伺服器\
它可以讓我們以網頁的方式操作 vscode, 這通常很適合如果你是使用 iPad 或是手機操作的\
當然，直接灌在系統上面有可能會污染系統，我個人較傾向使用 Docker 的方式

使用官方的 image 並且在 `port 8080` 打開對外服務
```shell
$ mkdir -p ~/.config
$ docker run -it --name code-server -p 127.0.0.1:8080:8080 \
  -v "$HOME/.config:/home/coder/.config" \
  -v "$PWD:/home/coder/project" \
  -u "$(id -u):$(id -g)" \
  -e "DOCKER_USER=$USER" \
  codercom/code-server:latest
```

成功開啟之後，由於我們是使用 SSH 進行連接的，因此安全性可以由 SSH 提供，所以可以關閉 code server 本身的驗證\
在你的伺服器執行以下指令關閉密碼驗證
```shell
$ sed -i.bak 's/auth: password/auth: none/' ~/.config/code-server/config.yaml
```
並重啟 code server(`$ docker restart code-server`)

設定檔應該會長這樣
```
bind-addr: 127.0.0.1:8080
auth: none
password: xxxxxxxxxxxxxxxxxxxxxxxx
cert: false
```

> 注意到，這裡是 "關閉驗證"\
> 但由於我們會透過 SSH 進行遠端連線，所以安全性是建構在 SSH 之上\
> 如果不是，請務必打開驗證

<hr>

最後，因為服務沒有對外\
可以使用 [SSH Tunnel](#ssh-tunnel) 從外部連進 code server 進行開發
```shell
$ ssh -L 8080:127.0.0.1:8080 server
```

# VSCode Code Server
除了網頁版的方式之外，VSCode 官方出的套件，可以讓你的本機電腦 VSCode 連線到遠端的 VSCode\
聽起來有點雞肋，不過如果你像我一樣，可能剛好手邊的電腦效能沒有那麼好，就可以用這種方式

你需要的東西有
1. 兩台電腦都必須要安裝 [VSCode](https://code.visualstudio.com/)
2. 下載 [Remote - SSH](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh) 套件

然後點選左下角連接到 remote machine\
如果你前面 SSH 都有設定好，它會跳出選項，跟著操作基本上就可以了

# References
+ [設定 Linux 開放 ssh 連線](https://www.ruyut.com/2022/04/ssh-linux.html)
+ [How to Add SSH Public Key to Server](https://linuxhandbook.com/add-ssh-public-key-to-server/)
+ [06. Symmetric and Asymmetric Encryption](https://ithelp.ithome.com.tw/articles/10200172)
+ [How to setup SSH config ：使用 SSH 設定檔簡化指令與連線網址](https://medium.com/%E6%B5%A6%E5%B3%B6%E5%A4%AA%E9%83%8E%E7%9A%84%E6%B0%B4%E6%97%8F%E7%BC%B8/how-to-setup-ssh-config-%E4%BD%BF%E7%94%A8-ssh-%E8%A8%AD%E5%AE%9A%E6%AA%94-74ad46f99818)
+ [Install](https://coder.com/docs/code-server/latest/install#docker)
+ [Port forwarding via SSH](https://coder.com/docs/code-server/latest/guide#port-forwarding-via-ssh)
+ [$${HOME} or ${HOME} in Makefile?](https://stackoverflow.com/questions/50751114/home-or-home-in-makefile)
+ [SSH Tunneling (Port Forwarding) 詳解](https://johnliu55.tw/ssh-tunnel.html)