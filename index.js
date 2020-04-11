function start() {
    console.log('af');
    axios.post('/start').then((result) => {
        console.log(result)
    })
}