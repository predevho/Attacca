variable "aws_region" {
  type    = string
  default = "ap-northeast-2"
}

variable "aws_profile" {
  type    = string
  default = "attacca-terraform"
}

variable "expected_account_id" {
  type    = string
  default = "530310463238"
}

variable "expected_instance_id" {
  type    = string
  default = "i-0c04da18f6eb5292d"
}

variable "expected_db_identifier" {
  type    = string
  default = "attacca-db"
}
