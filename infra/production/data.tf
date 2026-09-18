data "aws_caller_identity" "current" {}

data "aws_vpc" "attacca" {
  id = "vpc-0da3998132b39cea4"
}

data "aws_subnet" "attacca" {
  id = "subnet-0e18fa8c2b2bfaffb"
}

data "aws_db_instance" "attacca" {
  db_instance_identifier = var.expected_db_identifier
}

check "account_guard" {
  assert {
    condition     = data.aws_caller_identity.current.account_id == var.expected_account_id
    error_message = "Attacca Terraform은 운영 계정 530310463238에서만 실행해야 합니다."
  }
}

check "region_guard" {
  assert {
    condition     = var.aws_region == "ap-northeast-2"
    error_message = "Attacca Terraform은 ap-northeast-2에서만 실행해야 합니다."
  }
}
