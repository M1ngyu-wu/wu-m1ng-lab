# pwn--rop+ret2text

依旧是上周卡我7，8个小时的题目

首先我们要调用read函数将/bin/sh写入.bss段，而且还只能写24字节

错误示例：

![image-20261019001118338](D:\Typora\图片\image-20261019001118338.png)

将/bin/sh写入.bss后不知道该如何控制返回地址

导致无法回到take_massage再次读取

出题人提示：试着动调一下，看看第一次read后寄存器的残留，想办法把rsi指向.bss，触发第二次read

思考ing









# pwn--shellcode

检查保护机制

![image-20261018223830317](D:\Typora\图片\image-20261018223830317.png)

与寻常的不一样，这题开了NX

拖进IDA![image-20261019003156341](D:\Typora\图片\image-20261019003156341.png)

看clean_and_jump的汇编![image-20261019003349509](D:\Typora\图片\image-20261019003349509.png)

由图可以看到清零了众多寄存器，但r15保持不变

而且程序从buf的第9个字节开始执行![image-20261019003917749](D:\Typora\图片\image-20261019003917749.png)

rsp=buf+8

用gdb调试后发现![image-20261019004622730](D:\Typora\图片\image-20261019004622730.png)

![image-20261019004725590](D:\Typora\图片\image-20261019004725590.png)

故r15=buf

先构造一段rop链，并用asm生成一段机器码

push r15; pop rdi：利用程序保留下来的缓冲区地址，让 RDI 指向 /bin/sh

al（rax的最低8位，一个字节）：利用 rax 已经为零的条件，把 RAX 设置为 59

![image-20261019012707567](D:\Typora\图片\image-20261019012707567.png)



![image-20261019011623223](D:\Typora\图片\image-20261019011623223.png)





攻击脚本

![image-20261019011931700](D:\Typora\图片\image-20261019011931700.png)