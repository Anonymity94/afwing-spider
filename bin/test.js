function relative2Absolute(path, basePath) {
    // www.baidu/test/public/index.html
    const regexp = /..\//g;
    let basePathList = basePath.split('/');
    const machList = path.match(regexp);

    let machListLength = 0;

    if (machList) {
        machListLength = machList.length;
    }
    // ../a.jpg
    const rest = basePathList.slice(0, basePathList.length - (machListLength + 1));
    rest.push(path.replace(/..\//g, ''))
    return rest.join('/')
}

console.log(relative2Absolute('../../a.jpg', 'www.baidu/test/public/index.html'))