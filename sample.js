const AWS = require('aws-sdk');
const yargs = require('yargs');

const ANY = 'any';

const argv = yargs
    .usage("Usage: $0 --vpc vpc_name")
    .example(
      "$0 --vpc my-vpc",
      "Returns VPC's all access groups rules as a layer-3 firewall access list")
      .option('vpc', {
        alias: 'v',
        description: 'VPC ID',
        type: 'string',
    })
    .help()
    .alias('help', 'h')
    .argv;

AWS.config.update({
  region:'us-west-22'
});

const ec2 = new AWS.EC2();

function getName(tags) {
  var name = 'noName?';
  tags.forEach(function(tag) {
    if (tag.Key == 'Name') name = tag.Value;
  });
  return name;
}

function extractRule(sgrule) {
  var rule = {
    source: {},
    destination: {},
    temp: {
      sgs : [],
      nets: []
    }
  };
  if (sgrule.IpProtocol == -1) {
    rule.protocol = ANY;
  } else {
    rule.protocol = sgrule.IpProtocol;
  }
  if (sgrule.FromPort) {
    if (sgrule.FromPort == sgrule.ToPort) {
      rule.port = sgrule.FromPort;
    } else {
      rule.port = sgrule.FromPort + "-" + sgrule.ToPort;
    }
  } else {
    rule.port = ANY;
  }
  sgrule.IpRanges.forEach(ipRange => {
    if (ipRange.CidrIp == "0.0.0.0/0") {
      rule.temp.nets.push(ANY);
    } else {
      rule.temp.nets.push(ipRange.CidrIp);
    }
  });
  sgrule.UserIdGroupPairs.forEach(userIdGroupPair => {
    rule.temp.sgs.push(userIdGroupPair.GroupId);
  });
  return rule;
}

async function getVpcs() {
  data = await ec2.describeVpcs({}).promise();
  console.log("Available VPCs, run with a --vpc argument with one of them to see access rules");
  data.Vpcs.forEach(vpc => console.log("  " + getName(vpc.Tags)));
}

async function getVpcIdForName(vpcName) {
  var params = {Filters: [
    {
      Name: 'tag:Name',
      Values: [
        vpcName
      ]
    }
  ]};

  data = await ec2.describeVpcs(params).promise();
  if(data.Vpcs.length > 0) {
    return data.Vpcs[0].VpcId;
  }
}


async function extract(vpcId) {
  var params = {Filters: [
    {
      Name: 'vpc-id',
      Values: [
        vpcId
      ]
    }
  ]};
  
  var data = await ec2.describeSecurityGroups(params).promise();

  var securityGroups = {};
  data.SecurityGroups.forEach(sg => {
    securityGroup = {
      GroupName: sg.GroupName,
      instances: [],
      rules: [],
    };

    sg.IpPermissions.forEach(sgrule => { // inbound rules
      rule = extractRule(sgrule);
      rule.source.sgs = rule.temp.sgs;
      rule.source.nets = rule.temp.nets;
      rule.destination.sgs = [sg.GroupId];
      rule.origin = "inbound";
      delete rule.temp;
      securityGroup.rules.push(rule);
    });
    sg.IpPermissionsEgress.forEach(sgrule => { // outbound rules
      rule = extractRule(sgrule);
      rule.destination.sgs = rule.temp.sgs;
      rule.destination.nets = rule.temp.nets;
      rule.source.sgs = [sg.GroupId];
      rule.origin = "outbound";
      delete rule.temp;
      securityGroup.rules.push(rule);
    });


    securityGroups[sg.GroupId] = securityGroup;
  
  });
  
  data = await ec2.describeInstances(params).promise();

  data.Reservations.forEach(reservation => {
    reservation.Instances.forEach(instance => {
      if (instance.SecurityGroups) {
        instance.SecurityGroups.forEach(group => {
          securityGroups[group.GroupId].instances.push({
            name: getName(instance.Tags),
            ip: instance.PrivateIpAddress,
          });
        });
      }
    });
  });
  
  var objects = {};
  for (var sgid in securityGroups) {
  // Object.keys(securityGroups).forEach(sgid => {
    var instances = [];
    securityGroups[sgid].instances.forEach(instance => {
      instances.push(instance.name+"("+instance.ip+")");
    });
    if (instances.length == 0) {
      objects[sgid] = securityGroups[sgid].GroupName;
    } else {
      objects[sgid] = securityGroups[sgid].GroupName+"\n     "+instances.join("\n     ");
    }
  }

  var rules = [];
  for (var sgid in securityGroups) {
  // Object.keys(securityGroups).forEach(sgid => {
    securityGroups[sgid].rules.forEach(sgrule => {
      var rule = {
        protocol: sgrule.protocol,
        port: sgrule.port,
        source: [],
        destination: []
      };
      sgrule.source.sgs.forEach(rulesg => {
        rule.source.push(objects[rulesg])
      });
      sgrule.destination.sgs.forEach(rulesg => {
        rule.destination.push(objects[rulesg])
      });

      if (sgrule.source.nets && sgrule.source.nets.length > 0) {
        rule.source.push(sgrule.source.nets);
      }
      if (sgrule.destination.nets && sgrule.destination.nets.length > 0) {
        rule.destination.push(sgrule.destination.nets);
      }

      rule.origin = securityGroups[sgid].GroupName + "(" + sgrule.origin + ")";

      rules.push(rule);
    });
  }

  // console.log(JSON.stringify(rules, null, 1));

  var output = [];
  output.push("protocol,port,source,destination,,origin");
  rules.forEach(rule => {
    output.push(rule.protocol+","+rule.port+",\""+rule.source.join("\n")+"\",\""+rule.destination.join("\n")+"\",,"+rule.origin)
  });

  const fs = require('fs');
  fs.writeFile("output.csv", output.join("\n"), err => {
    if(err) {
      return console.log(err);
    }
  }); 
  
}


async function runme() {
  if (argv.vpc) {
    var vpcId = await getVpcIdForName(argv.vpc);
    if (vpcId) {
      await extract(vpcId);
    } else {
      console.log("VPC not found...")
    }
  } else {
    getVpcs();
  }
}


try {
  runme();
} catch (e) {
  console.error(e)
  throw e;
}
