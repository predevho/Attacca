resource "aws_security_group" "ec2" {
  name        = "attacca-ec2-sg"
  description = "Attacca web server"
  vpc_id      = "vpc-0da3998132b39cea4"

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH administrator"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["221.150.55.62/32", "211.55.87.209/32"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle {
    prevent_destroy = true
    ignore_changes  = all
  }
}

resource "aws_security_group" "rds" {
  name        = "attacca-rds-sg"
  description = "Created by RDS management console"
  vpc_id      = "vpc-0da3998132b39cea4"

  ingress {
    description     = "MySQL from EC2"
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
  }

  ingress {
    description = "MySQL administrator"
    from_port   = 3306
    to_port     = 3306
    protocol    = "tcp"
    cidr_blocks = ["211.55.87.209/32"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle {
    prevent_destroy = true
    ignore_changes  = all
  }
}
