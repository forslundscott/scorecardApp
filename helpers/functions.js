function titleCase(xstr){
    return xstr.charAt(0).toUpperCase() + xstr.slice(1)
}

function dotProduct(array1, array2) {
    var output = 0.0
    for(var i=0; i<array1.length; i++){
        output += (array1[i] * array2[i])
    }
    return output
}

module.exports = {titleCase,dotProduct}