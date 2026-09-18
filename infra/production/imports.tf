import {
  to = aws_instance.attacca
  id = "i-0c04da18f6eb5292d"
}

import {
  to = aws_db_instance.attacca
  id = "attacca-db"
}

import {
  to = aws_eip.attacca
  id = "eipalloc-01966a32c2b275242"
}

import {
  to = aws_eip_association.attacca
  id = "eipassoc-008e4a114fb9414da"
}

import {
  to = aws_security_group.ec2
  id = "sg-0b69d1a077984fddc"
}

import {
  to = aws_security_group.rds
  id = "sg-0452642da9fdafe45"
}
