FROM ubuntu

RUN apt-get install bzip2 curl libfreetype6 libfontconfig1  -y
RUN curl -k -O https://phantomjs.googlecode.com/files/phantomjs-1.9.2-linux-x86_64.tar.bz2
RUN tar -xvf phantomjs-1.9.2-linux-x86_64.tar.bz2 && rm phantomjs-1.9.2-linux-x86_64.tar.bz2
RUN mv /phantomjs-1.9.2-linux-x86_64 /usr/local/phantomjs-1.9.2-linux-x86_64
RUN ln -s /usr/local/phantomjs-1.9.2-linux-x86_64/bin/phantomjs /usr/local/bin/phantomjs
