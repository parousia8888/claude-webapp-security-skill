import { createRulesetV2 } from './ruleset-v2.mjs';

export const AWS_ADAPTER = {
  id: 'builtin-aws-exposure',
  version: '2.0.0',
  maturity: 'stable',
};

const definitions = [
  ['aws-cli-capability', 'evidence_integrity', 'high', 'AWS CLI capability'],
  ['aws-caller-identity', 'evidence_integrity', 'high', 'AWS caller identity'],
  ['aws-root-mfa', 'security_exposure', 'high', 'Root account MFA'],
  ['aws-root-access-keys', 'security_exposure', 'high', 'Root account access keys'],
  ['aws-iam-user-mfa', 'security_exposure', 'medium', 'IAM user MFA'],
  ['aws-iam-access-key-age', 'security_exposure', 'medium', 'IAM access-key age'],
  ['aws-iam-customer-policy-wildcard', 'security_exposure', 'high', 'Customer-managed IAM wildcard policy'],
  ['aws-iam-password-policy', 'security_exposure', 'low', 'IAM account password policy'],
  ['aws-security-group-sensitive-exposure', 'security_exposure', 'high', 'Security-group sensitive-port exposure'],
  ['aws-vpc-flow-logs', 'security_exposure', 'low', 'VPC flow logs'],
  ['aws-ec2-imdsv2', 'security_exposure', 'high', 'EC2 IMDSv2 enforcement'],
  ['aws-ebs-encryption-default', 'security_exposure', 'medium', 'EBS encryption by default'],
  ['aws-public-ebs-snapshot', 'security_exposure', 'high', 'Public EBS snapshots'],
  ['aws-public-ami', 'security_exposure', 'high', 'Public AMIs'],
  ['aws-s3-account-public-access-block', 'security_exposure', 'high', 'Account S3 Block Public Access'],
  ['aws-s3-bucket-public-access-block', 'security_exposure', 'medium', 'Bucket S3 Block Public Access'],
  ['aws-s3-public-policy', 'security_exposure', 'high', 'Public S3 bucket policy'],
  ['aws-s3-default-encryption', 'security_exposure', 'medium', 'S3 default encryption'],
  ['aws-rds-public-access', 'security_exposure', 'high', 'RDS public access'],
  ['aws-rds-storage-encryption', 'security_exposure', 'high', 'RDS storage encryption'],
  ['aws-rds-backups', 'reliability', 'high', 'RDS automated backups'],
  ['aws-rds-deletion-protection', 'reliability', 'low', 'RDS deletion protection'],
  ['aws-docdb-storage-encryption', 'security_exposure', 'high', 'DocumentDB storage encryption'],
  ['aws-docdb-deletion-protection', 'reliability', 'low', 'DocumentDB deletion protection'],
  ['aws-cloudfront-waf', 'security_exposure', 'medium', 'CloudFront WAF attachment'],
  ['aws-alb-access-logs', 'security_exposure', 'low', 'ALB access logs'],
  ['aws-cloudtrail-configured', 'security_exposure', 'high', 'CloudTrail configuration'],
  ['aws-cloudtrail-multiregion', 'security_exposure', 'medium', 'CloudTrail multi-region coverage'],
  ['aws-cloudtrail-log-validation', 'security_exposure', 'low', 'CloudTrail log validation'],
  ['aws-cloudtrail-logging', 'security_exposure', 'high', 'CloudTrail logging state'],
  ['aws-guardduty', 'security_exposure', 'medium', 'GuardDuty detector'],
  ['aws-config-recorder', 'security_exposure', 'low', 'AWS Config recorder'],
  ['aws-budgets', 'reliability', 'medium', 'AWS budget alarm'],
];

export const AWS_RULES = definitions.map(([id, domain, severity, title]) => ({
  id, revision: '1', domain, severity, title,
}));

export function awsRuleset() {
  return createRulesetV2([{ ...AWS_ADAPTER, rules: AWS_RULES }]);
}

export function awsRule(ruleId) {
  const rule = AWS_RULES.find((item) => item.id === ruleId);
  if (!rule) throw new Error(`AWS collector returned an unregistered rule: ${ruleId}`);
  return rule;
}

export function awsCoverage(observations) {
  return AWS_RULES.map((rule) => {
    const matches = observations.filter((observation) => observation.ruleId === rule.id);
    if (!matches.length) throw new Error(`AWS collector omitted required rule observation: ${rule.id}`);
    const evaluated = matches.filter((item) => ['passed', 'failed'].includes(item.state)).length;
    const unavailable = matches.filter((item) => item.state === 'unknown').length;
    const excluded = matches.filter((item) => item.state === 'not_applicable').length;
    const status = unavailable
      ? evaluated > 0 || excluded > 0 ? 'partial' : 'unavailable'
      : evaluated > 0 ? 'completed' : 'not_applicable';
    return {
      id: `aws-${rule.id}`,
      adapterId: AWS_ADAPTER.id,
      ruleId: rule.id,
      ruleRevision: rule.revision,
      status,
      counts: {
        discovered: matches.filter((item) => item.state === 'failed').length,
        eligible: evaluated + unavailable,
        scanned: evaluated,
        excluded,
        skipped: 0,
        truncated: 0,
        errors: unavailable,
      },
      reasons: [
        ...(unavailable ? [{ code: 'aws_operation_unavailable', count: unavailable, samplePaths: [] }] : []),
        ...(excluded ? [{ code: 'aws_check_not_applicable', count: excluded, samplePaths: [] }] : []),
      ],
    };
  });
}
