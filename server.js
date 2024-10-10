var express = require('express'),
    bodyParser = require('body-parser'),
    { URL } = require('url'),
    axios = require('axios'),
    app = express();

var myLimit = typeof (process.argv[2]) != 'undefined' ? process.argv[2] : '100kb';

const proxyList = [
    'https://api.codetabs.com/v1/proxy/?quest=',
    'https://cors-anywhere.herokuapp.com/',
    'https://yacdn.org/proxy/'
]

async function TestFetchXML() {

    let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: 'https://assessmentday.co.uk/candidate-preparation-hub/protected/Numerical/TP1/index.php?userid=2341&extratime=',
        headers: {
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'accept-language': 'en-GB,en;q=0.9',
            'cache-control': 'max-age=0',
            'cookie': 'PHPSESSID=f9b05e6243f24215ba4a9b97d6c5f2cf; amember_nr=982d3733b523e0b8e6c10a718e3b9c38; PHPSESSID=c3aa6208f3ebfa89313a9eff4408a4aa',
            'priority': 'u=0, i',
            'sec-ch-ua': '"Chromium";v="124", "Brave";v="124", "Not-A.Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Linux"',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'none',
            'sec-fetch-user': '?1',
            'sec-gpc': '1',
            'upgrade-insecure-requests': '1',
            'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Referer': 'https://assessmentday.co.uk/candidate-preparation-hub/protected/Numerical/TP1/index.php?userid=2341&extratime=',
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Origin': 'https://assessmentday.co.uk',
            'If-None-Match': '"RsbPTaeb+9YXZ16xA8Qb3nKyLWM="',
            'If-Modified-Since': 'Tue, 30 Apr 2024 13:03:43 GMT'
        }
    };

    return await axios.request(config)
        .then((response) => {
            console.log("\n\n inner data correct: ", response.data != undefined);
            return response.data;
        })
        .catch((error) => {
            console.error(error);
            return {}
        });

}

async function fetchProxy(url, options, i = 0) {

    const proxy = proxyList[i];

    const callResponse = await axios({
        url: proxy + url,
        method: options.method,
        headers: options.headers,
        data: options.body,
    }).then(res => {
        return res.data;
    }).catch(async error => {
        if (error.response) {
            console.error("error from response : ", error.response.status);
        } else if (error.request) {
            console.error("error from request : ", error.request);
        } else {
            console.error(`Try ${i} - Error`, error.message);
        }
        console.error("error config : ", error.config);

        console.log("trying again with ", proxyList[i + 1]);
        return await fetchProxy(url, options, i + 1);
    });

    return { res: callResponse, provider: proxy }

}
           
async function fetchPage(targetURLOrigin, req, cook = null) {
    const url = targetURLOrigin;
    const method = req.method;
    const body = JSON.stringify(req.body);
    let headersData = {};

    console.log("\nProxy for : ", url, cook);

    if (cook) {
        headersData = {
            'Authorization': req.header('Authorization'),
            'cookie': cook
        }
    } else {
        headersData = {
            'Authorization': req.header('Authorization'),
            'cookie': 'PHPSESSID=12f11bb4094db6db7ed3ad681b39e624; amember_nr=8e723ad9ce50f0f75f975d39d73b81fb;'
        }
    }

    let dataResponse = await axios({
        method: method,
        url: url,
        data: body,
        headers: headersData,
    })
        .then(async response => {
            if (response.data.url) {
                const cookieData = response.headers['set-cookie'];

                if (cookieData) {
                    const combinedCookie = cookieData.map(cookie => {
                        return cookie.split(";")[0]
                    }).join(';');

                    const outRes = await fetchPage(response.data.url, req, combinedCookie).then(async () => {
                        const inRes = await TestFetchXML();
                        console.log("inRes : ");
                        return inRes
                    })

                    console.log("outRes");
                    return outRes


                } else {

                    return fetchPage(response.data.url, req, null)
                }
            } else {

                return (response.data);
            }
        })
        .catch(error => {
            if (error.response) {
                console.error('Self try error : ' + error.response.status + " " + error);
            } else if (error.request) {
                console.error('Self try error - No response received', error.request);
            } else {
                console.error('Self try error - message', error.message);
            }
        });


    console.log("Pre check - current result is undefined : ", dataResponse == undefined);
    if (!dataResponse) {

        console.log("\nSelf proxy test failed. Switching to free proxy providers.");
        dataResponse = await fetchProxy(url, {}, 0)

        console.log(`\nProxy provider ${dataResponse.provider} successfull.`);
        return (dataResponse.res ?? dataResponse);
    } else {

        console.log("\nSelf Proxy successfull.");
        return (dataResponse.res ?? dataResponse);
    }

}

app.use(bodyParser.json({ limit: myLimit }));

app.all('*', async function (req, res, _next) {

    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, PUT, PATCH, POST, DELETE");
    res.header("Access-Control-Allow-Headers", req.header('access-control-request-headers'));

    if (req.method === 'OPTIONS') {

        res.send();
    } else {

        const parsedParam = req.url.slice(1);
        const targetURL = new URL(parsedParam);

        if (!targetURL.href) {
            res.send(500, { error: 'There is no Target-Endpoint header in the request' });
            return;
        }
        const finalProxy = await fetchPage(targetURL.href, req, null);
        console.log("outbound is undefined : ", finalProxy == undefined);
        res.send(finalProxy)
    }
});

app.set('port', process.env.PORT || 8081);

app.listen(app.get('port'), function () {
    console.log('Proxy server listening on port ' + app.get('port'));
});