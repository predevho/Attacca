variable "aws_region" {
  type    = string
  default = "ap-northeast-2"
}

variable "aws_profile" {
  type    = string
  default = "attacca-terraform"
}

variable "state_bucket_name" {
  type        = string
  description = "Account-unique S3 bucket for Terraform state."
}
