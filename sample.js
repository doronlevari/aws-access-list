var AWS = require('aws-sdk');

var creds = new AWS.Credentials('AKIAISHFKTZPL776QWAQ', 'RK6lTmndbuN6yM/khou2GJKi+K8F1GQH+RJwJWcp');
AWS.config.update({
  region:'us-west-2',
  credentials: creds
});
var ec2 = new AWS.EC2();

const VPC = 'vpc-47f51e21';
const ANY = 'any';


getName = function(tags) {
  name = 'noName?';
  tags.forEach(function(tag) {
    if (tag.Key == 'Name') name = tag.Value;
  });
  return name;
}
extractRule = function(sgrule) {
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
  sgrule.IpRanges.forEach(function(ipRange) {
    rule.temp.nets.push(ipRange.CidrIp);
  });
  sgrule.UserIdGroupPairs.forEach(function(userIdGroupPair) {
    rule.temp.sgs.push(userIdGroupPair.GroupId);
  });
  return rule;
}


var params = {Filters: [
  {
    Name: 'vpc-id',
    Values: [
      VPC
    ]
  }
]};

ec2.describeSecurityGroups(params, function(err, data) {
   if (err) console.log(err, err.stack); 
   else {
    var securityGroups = {};
    data.SecurityGroups.forEach(function(sg) {
      securityGroup = {
        GroupName: sg.GroupName,
        instances: [],
        rules: [],
      };

      sg.IpPermissions.forEach(function(sgrule) { // inbound rules
        rule = extractRule(sgrule);
        rule.source.sgs = rule.temp.sgs;
        rule.source.nets = rule.temp.nets;
        rule.destination.sgs = [sg.GroupId];
        rule.origin = "inbound";
        delete rule.temp;
        securityGroup.rules.push(rule);
      });
      sg.IpPermissionsEgress.forEach(function(sgrule) { // outbound rules
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

    ec2.describeInstances(params, function(err, data) {
      if (err) console.log(err, err.stack); 
      else {
        data.Reservations.forEach(function(reservation) {
          reservation.Instances.forEach(function(instance) {
            if (instance.SecurityGroups) {
              instance.SecurityGroups.forEach(function(group) {
                securityGroups[group.GroupId].instances.push({
                  name: getName(instance.Tags),
                  ip: instance.PrivateIpAddress,
                });
              });
            }
          });
        });
      }

      var objects = {};
      Object.keys(securityGroups).forEach(sgid => {
        var instances = [];
        securityGroups[sgid].instances.forEach(instance => {
          instances.push(instance.name+"("+instance.ip+")");
        });
        objects[sgid] = securityGroups[sgid].GroupName+"[\n     "+instances.join("\n     ")+"]"
      });

      var rules = [];
      Object.keys(securityGroups).forEach(sgid => {
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
          rule.source.push(sgrule.source.nets);
          sgrule.destination.sgs.forEach(rulesg => {
            rule.destination.push(objects[rulesg])
          });
          rule.destination.push(sgrule.destination.nets);

          rule.origin = securityGroups[sgid].GroupName + "(" + sgrule.origin + ")";

          rules.push(rule);

        });
      });
      // console.log(JSON.stringify(rules, null, 1));

      var output = [];
      output.push("protocol,port,source,destination,,origin");
      rules.forEach(rule => {
        output.push(rule.protocol+","+rule.port+",\""+rule.source.join("\n")+"\",\""+rule.destination.join("\n")+"\",,"+rule.origin)
      });

      const fs = require('fs');
      fs.writeFile("output.csv", output.join("\n"), function(err) {
          if(err) {
              return console.log(err);
          }
      }); 
    });
  }
});
