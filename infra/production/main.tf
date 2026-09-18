# 현재 단계는 기존 자원을 state에 편입하기 위한 선언 골격이다.
# import와 plan 검증 전에는 네트워크·EC2·RDS 설정을 변경하지 않는다.

resource "aws_instance" "attacca" {
  ami           = "ami-0e4ab31f1847c850c"
  instance_type = "t3.micro"
  subnet_id     = "subnet-0e18fa8c2b2bfaffb"
  key_name      = "attacca"

  vpc_security_group_ids = [aws_security_group.ec2.id]

  lifecycle {
    prevent_destroy = true
    ignore_changes  = all
  }

  tags = {
    Name      = "attacca"
    ManagedBy = "terraform"
    Project   = "attacca"
  }
}

resource "aws_db_instance" "attacca" {
  identifier              = var.expected_db_identifier
  engine                  = "mysql"
  engine_version          = "8.4.11"
  instance_class          = "db.t3.micro"
  allocated_storage       = 20
  storage_type            = "gp2"
  db_subnet_group_name    = "default-vpc-0da3998132b39cea4"
  vpc_security_group_ids  = [aws_security_group.rds.id]
  publicly_accessible     = false
  multi_az                = false
  backup_retention_period = 1
  deletion_protection     = false

  lifecycle {
    prevent_destroy = true
    ignore_changes  = all
  }
}

resource "aws_eip" "attacca" {
  domain = "vpc"

  lifecycle {
    prevent_destroy = true
    ignore_changes  = all
  }
}

resource "aws_eip_association" "attacca" {
  allocation_id = aws_eip.attacca.id
  instance_id   = aws_instance.attacca.id

  lifecycle {
    ignore_changes = all
  }
}
