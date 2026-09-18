output "state_bucket_name" {
  value = aws_s3_bucket.terraform_state.bucket
}

output "account_id" {
  value = data.aws_caller_identity.current.account_id
}
