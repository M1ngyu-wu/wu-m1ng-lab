# moe-syscall

![image-20261114144259155](D:\Typora\图片\image-20261114144259155.png)

![image-20261114144313384](D:\Typora\图片\image-20261114144313384.png)

  v3 = (void (__fastcall *)(_QWORD))mmap(addr: nullptr, len: 0x1000u, prot: 7, flags: 34, fd: -1, offset: 0);

`mmap()` 的作用是申请一块内存，并返回这块内存的起始地址。

所以v3=mmap返回的地址（设为B）

v4 = v3;

所以v4=B

最后调用 v4(a1: v4)

把 v4 当作函数入口地址，同时把 v4 自己作为这个函数的第一个参数