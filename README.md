# aws-access-list

Make sure your env is configured with region and credentials:
* Region: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-region.html
* Credentials, either:
    * https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/loading-node-credentials-shared.html
    * https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/loading-node-credentials-environment.html


Required Node.js version is `14.17.1`, avn will take care of it if you have that running for you.

Run
```
npm install
```

To run the thing, run:
```
node sample.js --vpc cdo-scale-vpc
```

Expect the output in `output.csv`

For all options run:
```
node sample.js --help
```



