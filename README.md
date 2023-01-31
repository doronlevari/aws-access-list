# aws-access-list

Print all your VPC's access groups rules as a layer-3 firewall access list! 
Drilling down into content of origin/destination Security Groups, "network object" style.
Easy to answer "what am I allowing?", "what am I blocking?", based on a search for an IP or CIDR.

Example:

![alt text](https://github.com/doronlevari/aws-access-list/blob/main/Doron-AWS.png?raw=true)

Check it out!

## Preparation...

### AWS Creds
Make sure your env is configured with region and credentials:
* Region: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-region.html
* Credentials, either:
    * https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/loading-node-credentials-shared.html
    * https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/loading-node-credentials-environment.html

### Node.js
Required Node.js version is `16.15.1`, avn will take care of it if you have that running for you.

Run
```
npm install
```

## Running the thing

To get a list of all available VPCs:
```
node sample.js
```

Then run with the VPC of your choice:
```
node sample.js --vpc my-eng-vpc
```

Expect the output in `output.csv`

For all options run:
```
node sample.js --help
```

